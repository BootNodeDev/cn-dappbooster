import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TokensPanel } from '@/components/TokensPanel'
import { getToastEntries, toast } from '@/components/ui/toast'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
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
const renderTokens = (
  api: Cip56HoldingsApi,
  transfersApi?: Cip56TransferApi,
  preapprovalApi?: AmuletPreapprovalApi,
): void => {
  render(
    <TestQueryClientProvider>
      <VaultContext.Provider value={baseVault()}>
        <TokensPanel
          api={api}
          transfersApi={transfersApi}
          preapprovalApi={preapprovalApi}
        />
      </VaultContext.Provider>
    </TestQueryClientProvider>,
  )
}

describe('TokensPanel', () => {
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

    renderTokens(api)

    await screen.findByText('Token holdings')
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

    renderTokens(api)

    await screen.findByText('15.75 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Show holdings' }))

    assert.equal(screen.getByText('cached-holding-cid').textContent, 'cached-holding-cid')
    assert.equal(detailsCalls, 0)
  })

  it('shows incoming transfers only when the active party has pending receipts', async () => {
    // Scenario: Tokens combines balances with token actions. Incoming transfers
    // should appear above holdings when pending, and disappear when the API has none.
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
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '42',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderTokens(holdingsApi, transfersApi)

    await screen.findByText('Incoming transfers')
    await screen.findByText('42 Amulet')
    await screen.findByText('7 Amulet')
  })

  it('hides the incoming transfer section when there are no pending receipts', async () => {
    // Scenario: an empty incoming-transfer list should not take vertical space
    // in Tokens; holdings remain the only visible token section.
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
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderTokens(holdingsApi, transfersApi)

    await screen.findByText('7 Amulet')
    assert.equal(screen.queryByText('Incoming transfers'), null)
    assert.equal(screen.queryByText('No pending transfers'), null)
  })

  it('enables Amulet auto-accept for the selected party', async () => {
    // Scenario: the selected party has no active Amulet receiver preapproval.
    // Enabling auto-accept must sign the prepared command for that same party.
    let createCalls = 0
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }
    const preapprovalApi: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async (receiver) => {
        assert.equal(receiver, 'alice::party')
        return { active: false, expired: false }
      },
      createAmuletPreapproval: async ({ account, signMessage, recordTransaction }) => {
        createCalls += 1
        assert.equal(account.partyId, 'alice::party')
        assert.equal(await signMessage(ACCOUNT.id, new Uint8Array()), 'signature')
        assert.ok(
          recordTransaction,
          'preapproval execution should be recorded like token transfers',
        )
        return { updateId: 'create-update-1' }
      },
      cancelAmuletPreapproval: async () => {
        throw new Error('cancel should not run while enabling')
      },
    }

    renderTokens(holdingsApi, undefined, preapprovalApi)

    await screen.findByText('Amulet auto-accept')
    await screen.findByText('Disabled')
    await userEvent.click(screen.getByRole('button', { name: 'Enable auto-accept' }))

    assert.equal(createCalls, 1)
  })

  it('keeps the polling context visible while Amulet auto-accept is being confirmed', async () => {
    // Scenario: enabling auto-accept can be committed before Scan reflects the
    // new TransferPreapproval. The panel should tell the user to wait.
    let resolveCreate: (() => void) | undefined
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }
    const preapprovalApi: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
      createAmuletPreapproval: async () => {
        await new Promise<void>((resolve) => {
          resolveCreate = resolve
        })
        return { updateId: 'create-update-1' }
      },
      cancelAmuletPreapproval: async () => {
        throw new Error('cancel should not run while enabling')
      },
    }

    renderTokens(holdingsApi, undefined, preapprovalApi)

    await screen.findByText('Disabled')
    await userEvent.click(screen.getByRole('button', { name: 'Enable auto-accept' }))

    const pendingMessage = await screen.findByText('This can take a few moments.')
    assert.match(
      pendingMessage.getAttribute('class') ?? '',
      /bg-muted/,
      'pending confirmation should look like an informational state, not a field value',
    )
    resolveCreate?.()
  })

  it('shows active Amulet auto-accept details and disables it for the selected party', async () => {
    // Scenario: the selected party already has an active receiver preapproval.
    // The panel should show its expiry and cancel the same receiver preapproval.
    let cancelCalls = 0
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }
    const preapprovalApi: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async (receiver) => {
        assert.equal(receiver, 'alice::party')
        return {
          active: true,
          expired: false,
          expiresAt: '2026-06-11T12:00:00.000Z',
          contractId: 'preapproval-cid-1',
        }
      },
      createAmuletPreapproval: async () => {
        throw new Error('create should not run while disabling')
      },
      cancelAmuletPreapproval: async ({ account }) => {
        cancelCalls += 1
        assert.equal(account.partyId, 'alice::party')
        return { updateId: 'cancel-update-1' }
      },
    }

    renderTokens(holdingsApi, undefined, preapprovalApi)

    await screen.findByText('Enabled')
    await screen.findByText('Expires 2026-06-11 12:00 UTC')
    await screen.findByText('prea..id-1')
    await userEvent.click(screen.getByRole('button', { name: 'Disable auto-accept' }))

    assert.equal(cancelCalls, 1)
  })

  it('shows a compact copyable Amulet auto-accept contract id', async () => {
    // Scenario: the active preapproval contract id is useful for debugging, but
    // it is too long to render as a raw value in the wallet card.
    const copied: string[] = []
    const contractId =
      '000399a68ea61b6f7864584d0c783db8bb6d6ea2ff9f1a3ec923949c787fd0ac27ca1212209fcebb9611ddbf454ed02c9c29d6a4f0f2081be58e636ee00819e750bc9d449c'
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: async (value: string) => void copied.push(value) },
      configurable: true,
    })
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }
    const preapprovalApi: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({
        active: true,
        expired: false,
        contractId,
      }),
      createAmuletPreapproval: async () => {
        throw new Error('create should not run for an active preapproval')
      },
      cancelAmuletPreapproval: async () => ({ updateId: 'cancel-update-1' }),
    }

    renderTokens(holdingsApi, undefined, preapprovalApi)

    await screen.findByText('contractId:')
    await screen.findByText('0003..449c')
    assert.equal(screen.queryByText(contractId), null)
    await userEvent.click(screen.getByRole('button', { name: 'Copy contract ID' }))

    assert.deepEqual(copied, [contractId])
    assert.deepEqual(
      getToastEntries().map((entry) => entry.message),
      ['Contract ID copied'],
    )
  })

  it('marks expired Amulet auto-accept as not active', async () => {
    // Scenario: a preapproval contract can still exist after its expiry.
    // The UI should label it expired so the user can clear it before creating a fresh one.
    const holdingsApi: Cip56HoldingsApi = {
      listTokenHoldingSummaries: async () => [],
    }
    const preapprovalApi: AmuletPreapprovalApi = {
      getAmuletPreapprovalStatus: async () => ({
        active: false,
        expired: true,
        expiresAt: '2026-06-01T12:00:00.000Z',
        contractId: 'expired-preapproval-cid',
      }),
      createAmuletPreapproval: async () => {
        throw new Error('create should not run for expired status action')
      },
      cancelAmuletPreapproval: async () => ({ updateId: 'cancel-expired-1' }),
    }

    renderTokens(holdingsApi, undefined, preapprovalApi)

    await screen.findByText('Expired')
    await screen.findByText('Expires 2026-06-01 12:00 UTC')
    await screen.findByText('expi..-cid')
    assert.ok(screen.getByRole('button', { name: 'Disable auto-accept' }))
  })
})
