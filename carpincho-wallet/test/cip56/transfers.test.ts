import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { acceptPendingTransfer, listPendingIncomingTransfers } from '@/cip56/transfers'
import type { AccountPublic } from '@/vault/types'

const originalFetch = globalThis.fetch

const ACCOUNT: AccountPublic = {
  // Account fixture represents the self-custodial party that receives an incoming CIP-56 transfer.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('CIP-56 wallet-service transfer helpers', () => {
  afterEach(() => {
    // Each test replaces fetch with a purpose-built JSON-RPC fake, so restore the global afterward.
    globalThis.fetch = originalFetch
    localStorage.clear()
  })

  it('lists pending incoming transfers through wallet-service without reshaping SDK contracts', async () => {
    // Scenario: wallet-service returns the raw-ish SDK pending transfer contracts.
    // Carpincho should pass that shape through so a future browser SDK can replace this adapter directly.
    const pendingContracts = [
      {
        contractId: 'transfer-cid-1',
        interfaceViewValue: {
          transfer: {
            sender: 'sender::party',
            receiver: 'alice::party',
            amount: '12.5',
            instrumentId: { admin: 'admin::party', id: 'Amulet' },
          },
        },
      },
    ]
    const methods: string[] = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown }
      methods.push(body.method)
      assert.deepEqual(body.params, { partyId: 'alice::party' })
      return new Response(JSON.stringify({ result: pendingContracts }), { status: 200 })
    }) as typeof globalThis.fetch

    const result = await listPendingIncomingTransfers('alice::party')

    assert.deepEqual(result, pendingContracts)
    assert.deepEqual(methods, ['cip56.listPendingTransfers'])
  })

  it('accepts a pending transfer by asking wallet-service for commands and keeping signing in Carpincho', async () => {
    // Scenario: wallet-service uses Node-only SDK helpers to prepare the CIP-56 accept command.
    // Carpincho then prepares, signs, executes, and records the transaction with its local vault key.
    const calls: Array<{ method: string; params: Record<string, unknown> }> = []
    globalThis.fetch = (async (_input, init) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: Record<string, unknown>
      }
      calls.push({ method: body.method, params: body.params })
      if (body.method === 'cip56.acceptTransfer') {
        return new Response(
          JSON.stringify({
            result: {
              commands: { ExerciseCommand: { choice: 'AcceptTransferInstruction' } },
              disclosedContracts: [
                { contractId: 'registry-context-cid', createdEventBlob: 'blob' },
              ],
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'prepareTransaction') {
        return new Response(
          JSON.stringify({
            result: {
              preparedTransaction: 'prepared-tx',
              preparedTransactionHash: 'prepared-hash',
              hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
            },
          }),
          { status: 200 },
        )
      }
      if (body.method === 'executePrepared') {
        return new Response(JSON.stringify({ result: { updateId: 'update-1' } }), { status: 200 })
      }
      throw new Error(`unexpected method ${body.method}`)
    }) as typeof globalThis.fetch
    const recorded: unknown[] = []

    const result = await acceptPendingTransfer({
      account: ACCOUNT,
      transferInstructionCid: 'transfer-cid-1',
      signMessage: async (accountId, messageBase64) => {
        assert.equal(accountId, 'account-1')
        assert.equal(messageBase64, 'prepared-hash')
        return 'signature-base64'
      },
      recordTransaction: async (tx) => {
        recorded.push(tx)
        return { ...tx, id: 'tx-1', createdAt: 2 }
      },
    })

    assert.deepEqual(result, { updateId: 'update-1' })
    assert.deepEqual(
      calls.map((call) => call.method),
      ['cip56.acceptTransfer', 'prepareTransaction', 'executePrepared'],
    )
    assert.deepEqual(calls[0]?.params, { transferInstructionCid: 'transfer-cid-1' })
    assert.deepEqual(calls[1]?.params, {
      partyId: 'alice::party',
      actAs: ['alice::party'],
      commands: { ExerciseCommand: { choice: 'AcceptTransferInstruction' } },
      disclosedContracts: [{ contractId: 'registry-context-cid', createdEventBlob: 'blob' }],
    })
    assert.deepEqual(calls[2]?.params, {
      preparedTransaction: 'prepared-tx',
      preparedTransactionHash: 'prepared-hash',
      hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2',
      partyId: 'alice::party',
      signatureBase64: 'signature-base64',
    })
    assert.equal((recorded[0] as { method?: string } | undefined)?.method, 'cip56.transfer.accept')
  })
})
