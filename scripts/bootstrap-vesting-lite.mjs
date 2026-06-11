#!/usr/bin/env node
// Bootstrap the Vesting Lite demo. Creates a backstage `operator` (owns the
// observer-less VestingFactory that grantors use via explicit disclosure) plus a
// pool of named parties to pick from, grants the wallet-service CanActAs each,
// pre-creates the operator factory, and emits {pkg, operator}; the dApp reads the
// party pool from the wallet (listAccounts), not this file. Run with the local stack up.

const RPC_URL = process.env.RPC_URL ?? 'http://localhost:3010/rpc'
const OUT = process.env.OUT ?? 'dapp/frontend/public/vesting-lite-parties.json'
// Deploy-specific vesting-lite package id (override with PKG=... after a rebuild).
const PKG = process.env.PKG ?? 'cb2c14a74262545f4dbc8fb7c98a1808bc2ad2cf12c5d348d875a842e1ab4cf1'
const FACTORY = `${PKG}:Vesting:VestingFactory`
const POOL_NAMES = ['pablo', 'manu', 'licha', 'nico', 'gabi', 'fer', 'kakaroto', 'vegeta', 'karpincho']
const STAMP = Date.now()

const rpc = async (method, params) => {
    const response = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method, params }),
    })
    const text = await response.text()
    const payload = JSON.parse(text)
    if (!response.ok || payload.error !== undefined) {
        throw new Error(`${method} failed: ${text.slice(0, 400)}`)
    }
    return payload.result
}

const ledger = (requestMethod, resource, body) =>
    rpc('ledgerApi', { requestMethod, resource, ...(body === undefined ? {} : { body }) })

const createParty = async (hint) => {
    const result = await ledger('post', '/v2/parties', { partyIdHint: hint })
    const party = result?.partyDetails?.party
    if (typeof party !== 'string' || party.length === 0) {
        throw new Error(`no party id for hint ${hint}: ${JSON.stringify(result)}`)
    }
    await ledger('post', '/v2/users/wallet-service/rights', {
        userId: 'wallet-service',
        identityProviderId: '',
        rights: [{ kind: { CanActAs: { value: { party } } } }],
    })
    return party
}

const main = async () => {
    const operator = await createParty(`vesting-operator-${STAMP}`)
    console.log(`operator    ${operator}`)

    const pool = []
    for (const name of POOL_NAMES) {
        const partyId = await createParty(`vesting-${name}-${STAMP}`)
        pool.push({ name, partyId })
        console.log(`${name.padEnd(11)} ${partyId}`)
    }

    // Pre-create the operator-owned, observer-less factory grantors disclose.
    await ledger('post', '/v2/commands/submit-and-wait-for-transaction-tree', {
        commandId: `vesting-factory-${STAMP}`,
        actAs: [operator],
        readAs: [operator],
        commands: [{ CreateCommand: { templateId: FACTORY, createArguments: { provider: operator } } }],
    })
    console.log('\noperator factory created')

    const fs = await import('node:fs/promises')
    const out = { createdAt: new Date().toISOString(), rpcUrl: RPC_URL, pkg: PKG, operator }
    await fs.writeFile(OUT, `${JSON.stringify(out, null, 2)}\n`, 'utf8')
    console.log(`Wrote ${OUT}`)
}

await main()
