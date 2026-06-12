import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { HomeTabs } from '@/components/HomeTabs'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
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

// Keeps the Transfers tab auto-accept toggle inert for navigation-focused scenarios.
const inactivePreapprovalApi: AmuletPreapprovalApi = {
  getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
  createAmuletPreapproval: async () => ({ updateId: 'noop' }),
  cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
}

// Wraps HomeTabs in the providers its child panels depend on (query, tooltip, vault).
const renderHome = (vault: VaultContextValue, children: ReactNode): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={vault}>{children}</VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

describe('HomeTabs navigation', () => {
  afterEach(() => {
    // HomeTabs child panels can own polling hooks, so unmount them between scenarios.
    cleanup()
  })

  it('renders Assets, Transfers, Activity, and Send tabs', () => {
    // Scenario: token balances, incoming transfers, history, and sending each own a
    // top-level tab. Assets is the default landing view.
    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    assert.equal(screen.getByRole('tab', { name: 'Assets' }).getAttribute('data-state'), 'active')
    assert.ok(screen.getByRole('tab', { name: 'Transfers' }))
    assert.ok(screen.getByRole('tab', { name: 'Activity' }))
    assert.ok(screen.getByRole('tab', { name: 'Send' }))
  })

  it('opens the Assets tab with the current party holdings', async () => {
    // Scenario: token balances live in the Assets tab, separate from incoming
    // transfer requests. Opening Assets should mount the holdings panel for the
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

    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        tokensApi={holdingsApi}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Assets' }))

    await screen.findByText('7 Amulet')
  })

  it('badges the Transfers tab when hidden incoming transfers require action', async () => {
    // Scenario: incoming transfer polling lives in the Transfers tab, which stays
    // mounted while Activity is selected so pending receiver-acceptance work can
    // still badge the tab.
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

    renderHome(
      baseVault(),
      <HomeTabs
        transactions={[]}
        tokensApi={holdingsApi}
        transfersApi={transfersApi}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    assert.equal(screen.getByRole('tab', { name: 'Assets' }).getAttribute('data-state'), 'active')
    await screen.findByRole('tab', { name: 'Transfers 1' })
  })

  it('shows Activity only for the selected account', async () => {
    // Scenario: Alice and Bob share one local vault, but Activity belongs to the
    // selected party. Switching to Bob must hide Alice's transaction history.
    renderHome(
      { ...baseVault(), accounts: [ACCOUNT, SECOND_ACCOUNT], primary: SECOND_ACCOUNT },
      <HomeTabs
        account={SECOND_ACCOUNT}
        transactions={[
          txFor(ACCOUNT, 'tx-alice', 'Alice transfer'),
          txFor(SECOND_ACCOUNT, 'tx-bob', 'Bob transfer'),
        ]}
        preapprovalApi={inactivePreapprovalApi}
      />,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Activity' }))

    assert.equal(screen.queryByText('Alice transfer'), null)
    assert.equal(screen.getByText('Bob transfer').textContent, 'Bob transfer')
  })
})
