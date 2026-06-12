#!/usr/bin/env node
/**
 * Top up an Amulet (Canton Coin) balance for any party on Splice LocalNet.
 *
 *   node scripts/topup-amulet.mjs <party> <amount>
 *
 * Mechanism (matches the handover):
 *   1. Mint a Splice unsafe-auth JWT (aud https://canton.network.global, HMAC "unsafe").
 *   2. Ensure the app-provider (the local validator operator / funder) holds enough Amulet;
 *      if not, `tap` the validator faucet (:3903) — tap only ever mints to the operator.
 *   3. Prepare a CIP-56 transfer app-provider -> <party> via the wallet-service
 *      `cip56.createTransfer` (:3010 /rpc), which returns the TransferFactory exercise command
 *      plus the disclosed contracts (AmuletRules / OpenMiningRound / input Amulet).
 *   4. Submit that command AS the app-provider through the wallet-service `ledgerApi` proxy
 *      (submit-and-wait), carrying the disclosed contracts + their synchronizerId.
 *
 * The target must have Amulet preapproval enabled (Carpincho Tokens tab, or
 * amulet.preapproval.* RPCs) so the transfer auto-accepts. Without preapproval the transfer
 * lands as a pending TransferInstruction the recipient must accept manually.
 *
 * Verifies the target's holdings via `cip56.listHoldingSummary` before and after.
 */

import { createHmac } from 'node:crypto'

// ---------------------------------------------------------------------------
// Config (runtime topology — see HANDOVER.md, do NOT re-derive)
// ---------------------------------------------------------------------------
const RPC_URL = 'http://localhost:3010/rpc'
const TAP_API = 'http://localhost:3903'
const HMAC_SECRET = 'unsafe'
const APP_PROVIDER_PARTY =
  'appprovider-localparty-1::1220e352fba014c1faedb9432b08021c34b1c4cbfd99f3cfda95a5f0a58027d1d53c'

// Tap this much (CC) into the operator whenever its available balance dips below the target.
const TAP_AMOUNT = 5000
// Keep the operator comfortably above the requested transfer so fees never starve it.
const OPERATOR_MIN_HEADROOM = 100

// ---------------------------------------------------------------------------
// JWT
// ---------------------------------------------------------------------------
const base64url = (buf) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const mintToken = (sub) => {
  const header = base64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const payload = base64url(
    Buffer.from(JSON.stringify({ sub, aud: 'https://canton.network.global', exp: 9999999999 })),
  )
  const sig = base64url(createHmac('sha256', HMAC_SECRET).update(`${header}.${payload}`).digest())
  return `${header}.${payload}.${sig}`
}

// ---------------------------------------------------------------------------
// JSON-RPC client for the wallet-service
// ---------------------------------------------------------------------------
let rpcId = 0

async function rpc(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const payload = await response.json()
  if (payload.error !== undefined) {
    throw new Error(`${method} failed: ${JSON.stringify(payload.error)}`)
  }
  return payload.result
}

// `ledgerApi` proxies the JSON Ledger API; we use it to act AS the hosted app-provider party.
async function ledgerApi(requestMethod, resource, body) {
  return rpc('ledgerApi', { requestMethod, resource, ...(body === undefined ? {} : { body }) })
}

// ---------------------------------------------------------------------------
// Amulet helpers
// ---------------------------------------------------------------------------
async function availableAmulet(partyId) {
  const summaries = await rpc('cip56.listHoldingSummary', { partyId })
  const amulet = summaries.find((s) => s.instrumentId?.id === 'Amulet')
  return amulet === undefined ? 0 : parseFloat(amulet.totalAmount)
}

async function tapOperator(appToken) {
  const response = await fetch(`${TAP_API}/api/validator/v0/wallet/tap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${appToken}` },
    body: JSON.stringify({ amount: String(TAP_AMOUNT) }),
  })
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`tap failed (HTTP ${response.status}): ${text}`)
  }
  return text
}

// The cip56.createTransfer disclosed contracts carry debug-only fields the Ledger API rejects.
function cleanDisclosed(disclosed) {
  return disclosed.map(({ templateId, contractId, createdEventBlob, synchronizerId }) => ({
    templateId,
    contractId,
    createdEventBlob,
    synchronizerId,
  }))
}

function uniqueCommandId() {
  return `topup-amulet-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const [party, amountArg] = process.argv.slice(2)
  if (party === undefined || amountArg === undefined) {
    console.error('Usage: node scripts/topup-amulet.mjs <party> <amount>')
    process.exit(1)
  }
  const amount = parseFloat(amountArg)
  if (Number.isNaN(amount) || amount <= 0) {
    console.error(`Invalid amount: ${amountArg}`)
    process.exit(1)
  }

  console.log(`=== Top up ${amount} Amulet -> ${party} ===\n`)

  const appToken = mintToken('app-provider')

  // --- 1. Ensure the operator (funder) is funded ---
  let operatorBalance = await availableAmulet(APP_PROVIDER_PARTY)
  console.log(`[1] App-provider available: ${operatorBalance} CC`)
  if (operatorBalance < amount + OPERATOR_MIN_HEADROOM) {
    console.log(`    Below ${amount + OPERATOR_MIN_HEADROOM} CC — tapping ${TAP_AMOUNT} CC...`)
    console.log(`    Tap: ${await tapOperator(appToken)}`)
    // Scan aggregates lag the tap slightly; give it a moment then re-read.
    await new Promise((r) => setTimeout(r, 3000))
    operatorBalance = await availableAmulet(APP_PROVIDER_PARTY)
    console.log(`    App-provider available after tap: ${operatorBalance} CC`)
  }

  // --- 2. Check target preapproval (informational; the transfer may otherwise stay pending) ---
  const preapproval = await rpc('amulet.preapproval.status', { receiver: party })
  console.log(`[2] Target preapproval: active=${preapproval.active} expired=${preapproval.expired}`)
  if (!preapproval.active) {
    console.log(
      '    WARNING: target has no active Amulet preapproval — the transfer will land as a',
    )
    console.log('    pending TransferInstruction the recipient must accept, not auto-credit.')
  }
  const before = await availableAmulet(party)
  console.log(`    Target available before: ${before} CC`)

  // --- 3. Prepare the CIP-56 transfer (operator -> target) ---
  console.log(`\n[3] Preparing cip56.createTransfer ${APP_PROVIDER_PARTY.slice(0, 24)}... -> target`)
  const prepared = await rpc('cip56.createTransfer', {
    sender: APP_PROVIDER_PARTY,
    recipient: party,
    amount: String(amount),
    instrumentId: 'Amulet',
  })
  const commands = Array.isArray(prepared.commands) ? prepared.commands : [prepared.commands]
  const disclosed = cleanDisclosed(prepared.disclosedContracts ?? [])
  const synchronizerId = disclosed.find((d) => d.synchronizerId)?.synchronizerId
  if (synchronizerId === undefined) {
    throw new Error('Could not derive synchronizerId from disclosed contracts')
  }
  console.log(`    ${commands.length} command(s), ${disclosed.length} disclosed contract(s)`)
  console.log(`    synchronizerId: ${synchronizerId}`)

  // --- 4. Submit AS the app-provider via the ledgerApi proxy ---
  console.log('\n[4] Submitting transfer as app-provider (submit-and-wait)...')
  const result = await ledgerApi('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
    actAs: [APP_PROVIDER_PARTY],
    readAs: [],
    commandId: uniqueCommandId(),
    commands,
    disclosedContracts: disclosed,
    synchronizerId,
  })
  const updateId = result?.transactionTree?.updateId ?? result?.transaction?.updateId ?? 'submitted'
  console.log(`    OK — ${updateId}`)

  // --- 5. Verify ---
  // Scan aggregates lag; poll a few times for the credit to show up.
  console.log('\n[5] Verifying target holdings...')
  let after = before
  for (let attempt = 0; attempt < 6; attempt += 1) {
    await new Promise((r) => setTimeout(r, 2000))
    after = await availableAmulet(party)
    if (after > before) {
      break
    }
  }
  console.log(`    Target available after: ${after} CC (was ${before})`)
  if (after > before) {
    console.log(`\n=== Done — credited ~${(after - before).toFixed(4)} CC to ${party} ===`)
  } else {
    console.log('\n=== Transfer submitted but target balance unchanged ===')
    console.log('    If the target has no preapproval, accept the pending TransferInstruction')
    console.log('    (Carpincho, or cip56.acceptTransfer) to complete the credit.')
  }
}

main().catch((err) => {
  console.error('topup-amulet failed:', err.message ?? err)
  process.exit(1)
})
