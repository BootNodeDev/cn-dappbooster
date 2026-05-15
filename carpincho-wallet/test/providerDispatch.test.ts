import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_SIGN_MESSAGE,
  dispatchProviderRequest,
  type ProviderResponder
} from '../src/provider/dispatch.ts'

const account = {
  id: 'acct-1',
  name: 'Alice',
  partyId: 'alice::fingerprint',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1
}

const captureResponder = (): ProviderResponder & {
  results: unknown[]
  errors: Array<{ code: number; message: string }>
} => {
  const results: unknown[] = []
  const errors: Array<{ code: number; message: string }> = []
  return {
    results,
    errors,
    result: async value => {
      results.push(value)
    },
    error: async (code, message) => {
      errors.push({ code, message })
    }
  }
}

describe('provider request dispatch', () => {
  it('returns CIP-0103 accounts through an injected responder', async () => {
    const responder = captureResponder()

    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_LIST_ACCOUNTS },
      () => ({ accounts: [account], primary: account }),
      responder
    )

    assert.deepEqual(result, { status: 'handled' })
    assert.equal(responder.errors.length, 0)
    assert.deepEqual(responder.results, [[{
      primary: true,
      partyId: 'alice::fingerprint',
      status: 'allocated',
      hint: 'Alice',
      publicKey: 'public-key',
      namespace: 'fingerprint',
      networkId: 'canton:local',
      signingProviderId: 'carpincho-wallet'
    }]])
  })

  it('returns pending approval for signMessage without transport-specific code', async () => {
    const responder = captureResponder()

    const result = await dispatchProviderRequest(
      { method: CANTON_METHOD_SIGN_MESSAGE, params: { message: 'aGVsbG8=' } },
      () => ({ accounts: [account], primary: account }),
      responder
    )

    assert.deepEqual(result, { status: 'pending-approval', pendingMethod: CANTON_METHOD_SIGN_MESSAGE })
    assert.equal(responder.results.length, 0)
    assert.equal(responder.errors.length, 0)
  })
})
