import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HomeTabs } from '@/components/HomeTabs'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
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

describe('HomeTabs asset indicators', () => {
  afterEach(() => {
    // The force-mounted Assets tab owns a polling hook, so unmount it between scenarios.
    cleanup()
  })

  it('shows a pending-transfer count on the Assets tab while Activity is selected', async () => {
    // Scenario: incoming Amulet transfers require action even when the user is
    // looking at Activity. The Assets panel should stay mounted while hidden so
    // its polling result can drive a compact tab indicator.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party',
              amount: '42',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    render(
      <VaultContext.Provider value={baseVault()}>
        <HomeTabs
          transactions={[]}
          assetsApi={api}
        />
      </VaultContext.Provider>,
    )

    assert.equal(screen.getByRole('tab', { name: 'Activity' }).getAttribute('data-state'), 'active')
    await waitFor(() => assert.ok(screen.getByRole('tab', { name: 'Assets 1' })))
    const incomingHeading = await screen.findByText('Incoming transfers')
    const inactivePanel = incomingHeading.closest('[data-state="inactive"]')
    assert.ok(inactivePanel, 'incoming transfer content should stay mounted in an inactive tab')
    assert.match(
      inactivePanel.getAttribute('class') ?? '',
      /data-\[state=inactive\]:hidden/,
      'inactive tab content must not be visible in Activity',
    )
  })

  it('opens the Tokens tab with the current party holdings', async () => {
    // Scenario: token balances live in their own tab, separate from incoming
    // transfer requests. Opening Tokens should mount the holdings panel for the
    // active account and show the grouped balance.
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldings: async () => [
        {
          contractId: 'holding-cid-1',
          interfaceViewValue: {
            owner: 'alice::party',
            amount: '7.0000000000',
            instrumentId: { admin: 'dso::party', id: 'Amulet' },
            lock: null,
          },
        },
      ],
    }

    render(
      <VaultContext.Provider value={baseVault()}>
        <HomeTabs
          transactions={[]}
          tokensApi={holdingsApi}
        />
      </VaultContext.Provider>,
    )

    await userEvent.click(screen.getByRole('tab', { name: 'Tokens' }))

    await screen.findByText('Token holdings')
    await screen.findByText('7 Amulet')
  })
})
