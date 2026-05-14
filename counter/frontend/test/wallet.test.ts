import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { selectWalletAccount, type WalletAccount } from '../src/walletAccount.js'

describe('wallet account selection', () => {
  it('uses the primary account when present', () => {
    const secondary: WalletAccount = { partyId: 'secondary::party' }
    const primary: WalletAccount = { partyId: 'primary::party', primary: true }

    assert.equal(selectWalletAccount([secondary, primary]), primary)
  })

  it('falls back to the first account', () => {
    const first: WalletAccount = { partyId: 'first::party' }

    assert.equal(selectWalletAccount([first]), first)
  })
})
