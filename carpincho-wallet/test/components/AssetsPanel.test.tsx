import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPanel } from '@/components/AssetsPanel'
import { toast } from '@/components/ui/toast'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
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
const renderAssets = (api: Cip56HoldingsApi): void => {
  render(
    <TestQueryClientProvider>
      <VaultContext.Provider value={baseVault()}>
        <AssetsPanel api={api} />
      </VaultContext.Provider>
    </TestQueryClientProvider>,
  )
}

describe('AssetsPanel', () => {
  const originalClipboard = globalThis.navigator?.clipboard

  afterEach(() => {
    // The panel owns a polling hook; cleanup unmounts it before the next scenario.
    cleanup()
    toast.clear()
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
  })

  it('shows token holding totals and expands UTXO details', async () => {
    // Scenario: the active party owns two Amulet holding UTXOs, one unlocked and one locked.
    // The panel should show a grouped total first and expose raw holding ids on demand.
    let detailsCalls = 0
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async (partyId) => {
        assert.equal(partyId, 'alice::party')
        return [
          {
            key: 'dso::party:Amulet',
            tokenLabel: 'Amulet',
            instrumentId: { admin: 'dso::party', id: 'Amulet' },
            totalAmount: '15.75',
            source: 'scan',
          },
        ]
      },
      listTokenHoldings: async (partyId) => {
        detailsCalls += 1
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

    renderAssets(api)

    await screen.findByText('15.75 Amulet')
    assert.equal(screen.getByText('UTXOs load on demand').textContent, 'UTXOs load on demand')
    assert.equal(screen.queryByText('holding-cid-1'), null)
    assert.equal(detailsCalls, 0)

    await userEvent.click(screen.getByRole('button', { name: 'Show holdings' }))

    const firstHoldingCard = screen.getByText('holding-cid-1').closest('dl')
    assert.ok(firstHoldingCard, 'holding details should be grouped in one UTXO card')
    assert.match(
      firstHoldingCard.getAttribute('class') ?? '',
      /rounded-md/,
      'each holding UTXO should read as a distinct item',
    )
    assert.match(
      firstHoldingCard.getAttribute('class') ?? '',
      /bg-surface/,
      'each holding UTXO should be visually separated from the detail container',
    )
    assert.equal(screen.getByText('holding-cid-1').textContent, 'holding-cid-1')
    assert.equal(screen.getByText('holding-cid-2').textContent, 'holding-cid-2')
    assert.equal(screen.queryByText('owner'), null)
    assert.equal(screen.getByText('2026-06-10 20:41 UTC').textContent, '2026-06-10 20:41 UTC')
    assert.equal(detailsCalls, 1)
  })

  it('reuses fallback UTXO details from the summary response', async () => {
    // Scenario: when wallet-service falls back from Scan to UTXOs, the summary
    // already contains raw holdings. Expanding the row must not make another
    // UTXO request for the same token.
    let detailsCalls = 0
    const api: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '15.75',
          utxoCount: 1,
          lockedCount: 0,
          unlockedCount: 1,
          source: 'utxos',
          holdings: [
            {
              contractId: 'cached-holding-cid',
              interfaceViewValue: {
                owner: 'alice::party',
                amount: '15.7500000000',
                instrumentId: { admin: 'dso::party', id: 'Amulet' },
                lock: null,
              },
            },
          ],
        },
      ],
      listTokenHoldings: async () => {
        detailsCalls += 1
        return []
      },
    }

    renderAssets(api)

    await screen.findByText('15.75 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Show holdings' }))

    assert.equal(screen.getByText('cached-holding-cid').textContent, 'cached-holding-cid')
    assert.equal(detailsCalls, 0)
  })
})
