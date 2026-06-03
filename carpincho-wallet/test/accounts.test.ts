import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { accountConnection, selectedAccount } from '@/wc/accounts'

const account = {
  id: 'acct-1',
  name: 'Alice',
  partyId: 'alice::fingerprint',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

describe('wallet account helpers', () => {
  it('does not report a connected wallet session without an account', () => {
    assert.deepEqual(
      accountConnection({ accounts: [], primary: null }, { isNetworkConnected: true }),
      {
        isConnected: false,
        isNetworkConnected: true,
        reason: 'No wallet account available.',
      },
    )
  })

  it('selects the primary account or falls back to the first account', () => {
    assert.equal(selectedAccount({ accounts: [account], primary: null }), account)
    assert.equal(selectedAccount({ accounts: [account], primary: account }), account)
  })
})
