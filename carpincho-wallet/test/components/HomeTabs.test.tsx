import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomeTabs } from '@/components/HomeTabs'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic, TransactionRecord } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active wallet party whose hidden tabs poll service state.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const SECOND_ACCOUNT: AccountPublic = {
  // Second account fixture catches stale tab state when the selected party changes.
  id: 'account-2',
  name: 'Bob',
  partyId: 'bob::party',
  publicKeyBase64: 'public-key-2',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 2,
}

// Creates an executed transaction tied to one wallet account for Activity filtering.
const txFor = (account: AccountPublic, id: string, summary: string): TransactionRecord => ({
  id,
  accountId: account.id,
  accountName: account.name,
  partyId: account.partyId,
  network: account.network,
  method: 'canton_prepareExecuteAndWait',
  status: 'executed',
  createdAt: Date.parse('2026-06-10T12:00:00.000Z'),
  preparedTransactionHash: `${id}-hash`,
  summary,
})

// Builds the minimum unlocked vault context required by HomeTabs child panels.
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

describe('HomeTabs token navigation', () => {
  afterEach(() => {
    // HomeTabs child panels can own polling hooks, so unmount them between scenarios.
    cleanup()
  })

  it('renders Activity, Tokens, and Send tabs without the former Assets tab', () => {
    // Scenario: token balances and incoming token actions now live under Tokens.
    // The top-level wallet navigation should expose token viewing and token sending separately.
    render(
      <TestQueryClientProvider>
        <VaultContext.Provider value={baseVault()}>
          <HomeTabs transactions={[]} />
        </VaultContext.Provider>
      </TestQueryClientProvider>,
    )

    assert.equal(screen.getByRole('tab', { name: 'Activity' }).getAttribute('data-state'), 'active')
    assert.ok(screen.getByRole('tab', { name: 'Tokens' }))
    assert.ok(screen.getByRole('tab', { name: 'Send' }))
    assert.equal(screen.queryByRole('tab', { name: /Assets/ }), null)
  })

  it('opens the Tokens tab with the current party holdings', async () => {
    // Scenario: token balances live in their own tab, separate from incoming
    // transfer requests. Opening Tokens should mount the holdings panel for the
    // active account and show the grouped balance.
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [
        {
          key: 'dso::party:Amulet',
          tokenLabel: 'Amulet',
          instrumentId: { admin: 'dso::party', id: 'Amulet' },
          totalAmount: '7',
          source: 'scan',
        },
      ],
    }

    render(
      <TestQueryClientProvider>
        <VaultContext.Provider value={baseVault()}>
          <HomeTabs
            transactions={[]}
            tokensApi={holdingsApi}
          />
        </VaultContext.Provider>
      </TestQueryClientProvider>,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Tokens' }))

    await screen.findByText('Token holdings')
    await screen.findByText('7 Amulet')
  })

  it('badges the Tokens tab when hidden incoming transfers require action', async () => {
    // Scenario: incoming transfer polling moved from the deleted Assets tab to
    // Tokens. The Tokens panel must stay mounted while Activity is selected so
    // pending receiver-acceptance work can still badge the tab.
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party',
              receiver: 'alice::party',
              amount: '42',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }

    render(
      <TestQueryClientProvider>
        <VaultContext.Provider value={baseVault()}>
          <HomeTabs
            transactions={[]}
            tokensApi={holdingsApi}
            transfersApi={transfersApi}
          />
        </VaultContext.Provider>
      </TestQueryClientProvider>,
    )

    assert.equal(screen.getByRole('tab', { name: 'Activity' }).getAttribute('data-state'), 'active')
    await screen.findByRole('tab', { name: 'Tokens 1' })
  })

  it('shows Activity only for the selected account', () => {
    // Scenario: Alice and Bob share one local vault, but Activity belongs to the
    // selected party. Switching to Bob must hide Alice's transaction history.
    render(
      <TestQueryClientProvider>
        <VaultContext.Provider
          value={{ ...baseVault(), accounts: [ACCOUNT, SECOND_ACCOUNT], primary: SECOND_ACCOUNT }}
        >
          <HomeTabs
            account={SECOND_ACCOUNT}
            transactions={[
              txFor(ACCOUNT, 'tx-alice', 'Alice transfer'),
              txFor(SECOND_ACCOUNT, 'tx-bob', 'Bob transfer'),
            ]}
          />
        </VaultContext.Provider>
      </TestQueryClientProvider>,
    )

    assert.equal(screen.queryByText('Alice transfer'), null)
    assert.equal(screen.getByText('Bob transfer').textContent, 'Bob transfer')
  })
})
