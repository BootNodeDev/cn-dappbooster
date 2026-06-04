import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { accountToCip103Wallet } from '@/provider/accounts'
import {
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_STATUS,
  LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE,
  normalizeMethod,
  pendingApprovalMethod,
} from '@/provider/methods'

const account = {
  id: 'acct-1',
  name: 'Alice',
  partyId: 'alice::fingerprint',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('provider method helpers', () => {
  it('normalizes legacy canton-prefixed methods', () => {
    assert.equal(normalizeMethod('canton_status'), CANTON_METHOD_STATUS)
    assert.equal(
      normalizeMethod(LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE),
      CANTON_METHOD_PREPARE_EXECUTE,
    )
    assert.equal(
      normalizeMethod(CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT),
      CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
    )
  })

  it('preserves legacy prepareSignExecute approval semantics', () => {
    assert.equal(
      pendingApprovalMethod(
        LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE,
        CANTON_METHOD_PREPARE_EXECUTE,
      ),
      CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
    )
    assert.equal(
      pendingApprovalMethod(CANTON_METHOD_PREPARE_EXECUTE, CANTON_METHOD_PREPARE_EXECUTE),
      CANTON_METHOD_PREPARE_EXECUTE,
    )
  })
})

describe('provider account helpers', () => {
  it('maps local accounts to the CIP-0103 wallet account shape', () => {
    assert.deepEqual(accountToCip103Wallet(account), {
      primary: true,
      partyId: 'alice::fingerprint',
      status: 'allocated',
      hint: 'Alice',
      publicKey: 'public-key',
      namespace: 'fingerprint',
      networkId: 'canton:local',
      signingProviderId: 'carpincho-wallet',
    })
  })
})
