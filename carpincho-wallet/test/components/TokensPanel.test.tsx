import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TokensPanel } from '@/components/TokensPanel'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active wallet party whose token holdings are displayed.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

// Builds the minimum unlocked vault context required by the holdings panel.
const baseVault = (): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: () => undefined,
    accounts: [ACCOUNT],
    primary: ACCOUNT,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ACCOUNT,
    removeAccount: async () => undefined,
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
    changePassword: async () => undefined,
    verifyPassword: () => true,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

// Mounts the panel under vault context so it can resolve the active account.
const renderTokens = (api: Cip56HoldingsApi): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <TokensPanel api={api} />
    </VaultContext.Provider>,
  )
}

describe('TokensPanel', () => {
  afterEach(() => {
    // The panel owns a polling hook; cleanup unmounts it before the next scenario.
    cleanup()
  })

  it('shows token holding totals and expands UTXO details', async () => {
    // Scenario: the active party owns two Amulet holding UTXOs, one unlocked and one locked.
    // The panel should show a grouped total first and expose raw holding ids on demand.
    const api: Cip56HoldingsApi = {
      listTokenHoldings: async (partyId) => {
        assert.equal(partyId, 'alice::party')
        return [
          {
            contractId: 'holding-cid-1',
            interfaceViewValue: {
              owner: 'alice::party',
              amount: '12.5000000000',
              instrumentId: { admin: 'dso::party', id: 'Amulet' },
              lock: null,
            },
          },
          {
            contractId: 'holding-cid-2',
            interfaceViewValue: {
              owner: 'alice::party',
              amount: '3.2500000000',
              instrumentId: { admin: 'dso::party', id: 'Amulet' },
              lock: { holders: ['validator::party'], expiresAt: '2026-06-10T20:41:05.803Z' },
            },
          },
        ]
      },
    }

    renderTokens(api)

    await screen.findByText('Token holdings')
    await screen.findByText('15.75 Amulet')
    assert.equal(screen.getByText('2 UTXOs').textContent, '2 UTXOs')
    assert.equal(screen.getByText('1 locked').textContent, '1 locked')
    assert.equal(screen.queryByText('holding-cid-1'), null)

    await userEvent.click(screen.getByRole('button', { name: 'Show holdings' }))

    assert.equal(screen.getByText('holding-cid-1').textContent, 'holding-cid-1')
    assert.equal(screen.getByText('holding-cid-2').textContent, 'holding-cid-2')
    assert.equal(screen.getByText('2026-06-10 20:41 UTC').textContent, '2026-06-10 20:41 UTC')
  })
})
