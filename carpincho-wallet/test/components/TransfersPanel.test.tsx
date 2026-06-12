import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TransfersPanel } from '@/components/TransfersPanel'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import { inactivePreapprovalApi } from '@/test-utils/preapproval'
import { TestQueryClientProvider } from '@/test-utils/queryClient'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Account fixture represents the active wallet party receiving an incoming Amulet transfer.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'public-key',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

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

// Mounts incoming transfers under vault context so accept can use wallet signing hooks.
const renderTransfers = (
  api: Cip56TransferApi,
  preapprovalApi: AmuletPreapprovalApi = inactivePreapprovalApi,
): void => {
  render(
    <TestQueryClientProvider>
      <TooltipProvider>
        <VaultContext.Provider value={baseVault()}>
          <TransfersPanel
            api={api}
            preapprovalApi={preapprovalApi}
          />
        </VaultContext.Provider>
      </TooltipProvider>
    </TestQueryClientProvider>,
  )
}

describe('TransfersPanel', () => {
  afterEach(() => {
    // Each render owns a hook polling loop; cleanup unmounts it before the next scenario.
    cleanup()
  })

  it('shows pending incoming transfers and accepts one from the active account', async () => {
    // Scenario: the selected party has one pending Amulet transfer that requires receiver acceptance.
    // The panel renders the SDK-shaped transfer view and delegates accept to the hook/API path.
    const calls: string[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => {
        calls.push('list')
        return calls.includes('accept')
          ? []
          : [
              {
                contractId: 'transfer-cid-1',
                interfaceViewValue: {
                  transfer: {
                    sender: 'sender-party-1234567890abcdef',
                    amount: '42',
                    instrumentId: { id: 'Amulet' },
                  },
                },
              },
            ]
      },
      acceptTransfer: async ({ account, transferInstructionCid }) => {
        calls.push('accept')
        assert.equal(account.id, 'account-1')
        assert.equal(transferInstructionCid, 'transfer-cid-1')
        return { updateId: 'update-1' }
      },
    }

    renderTransfers(api)

    await screen.findByText('42.00 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.ok(screen.getByText('No pending transfers')))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
  })

  it('does not show the removed "Incoming transfers" heading', async () => {
    // Scenario: the heading was redundant once outgoing transfers also appear here.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
    }

    renderTransfers(api)

    await screen.findByText('No pending transfers')
    assert.equal(screen.queryByText('Incoming transfers'), null)
  })

  it("shows the active party's own outgoing transfer as read-only pending", async () => {
    // Scenario: when sending between own accounts, the sender's outgoing transfer
    // is returned by the ledger query too. The sender must not be able to accept
    // it; it shows as awaiting the recipient's acceptance instead.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'outgoing-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'alice::party',
              receiver: 'bob-party-1234567890abcdef',
              amount: '10',
              instrumentId: { id: 'Amulet' },
            },
            status: { tag: 'TransferPendingReceiverAcceptance' },
          },
        },
      ],
      acceptTransfer: async () => {
        throw new Error('the sender must not accept their own transfer')
      },
    }

    renderTransfers(api)

    await screen.findByText('10.00 Amulet')
    await screen.findByText('Awaiting acceptance')
    assert.equal(screen.queryByRole('button', { name: 'Accept' }), null)
  })

  it('shows Accept for a transfer the active party sent to itself', async () => {
    // Scenario: a transfer whose sender and receiver are both the active party is
    // still only acceptable by that party as the receiver, so Accept must appear.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'self-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'alice::party',
              receiver: 'alice::party',
              amount: '7',
              instrumentId: { id: 'Amulet' },
            },
            status: { tag: 'TransferPendingReceiverAcceptance' },
          },
        },
      ],
      acceptTransfer: async ({ transferInstructionCid }) => {
        assert.equal(transferInstructionCid, 'self-cid-1')
        return { updateId: 'update-1' }
      },
    }

    renderTransfers(api)

    await screen.findByText('7.00 Amulet')
    assert.ok(screen.getByRole('button', { name: 'Accept' }))
    assert.equal(screen.queryByText('Awaiting acceptance'), null)
  })

  it('counts only incoming transfers toward the pending badge', async () => {
    // Scenario: a mixed list of one incoming and one outgoing transfer must show a
    // single Accept button and report a pending count of one to the parent badge.
    const counts: number[] = []
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'incoming-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '3',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
        {
          contractId: 'outgoing-cid-2',
          interfaceViewValue: {
            transfer: {
              sender: 'alice::party',
              receiver: 'bob-party-1234567890abcdef',
              amount: '4',
              instrumentId: { id: 'Amulet' },
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    render(
      <TestQueryClientProvider>
        <TooltipProvider>
          <VaultContext.Provider value={baseVault()}>
            <TransfersPanel
              api={api}
              preapprovalApi={inactivePreapprovalApi}
              onPendingCountChange={(count) => counts.push(count)}
            />
          </VaultContext.Provider>
        </TooltipProvider>
      </TestQueryClientProvider>,
    )

    await screen.findByText('Awaiting acceptance')
    assert.equal(screen.getAllByRole('button', { name: 'Accept' }).length, 1)
    assert.equal(counts.at(-1), 1)
  })

  it('shows transfer description and exposes raw details on demand', async () => {
    // Scenario: Amulet transfers can carry a sender-provided description and
    // operational metadata. The compact card should show the description, while
    // full parties, status, timestamps, and contract id stay behind a details toggle.
    const api: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [
        {
          contractId: 'transfer-cid-1',
          interfaceViewValue: {
            transfer: {
              sender: 'sender-party-1234567890abcdef',
              receiver: 'alice::party',
              amount: '666.0000000000',
              instrumentId: { id: 'Amulet' },
              requestedAt: '2026-06-09T20:41:05.841851Z',
              executeBefore: '2026-06-10T20:41:05.803Z',
              meta: {
                values: {
                  'splice.lfdecentralizedtrust.org/reason': 'invoice 42',
                },
              },
            },
            status: {
              tag: 'TransferPendingReceiverAcceptance',
            },
          },
        },
      ],
      acceptTransfer: async () => ({ updateId: 'update-1' }),
    }

    renderTransfers(api)

    await screen.findByText('666.00 Amulet')
    assert.equal(screen.getByText('invoice 42').textContent, 'invoice 42')
    assert.equal(screen.queryByText('transfer-cid-1'), null)

    await userEvent.click(screen.getByRole('button', { name: 'Show details' }))

    assert.equal(
      screen.getByText('sender-party-1234567890abcdef').textContent,
      'sender-party-1234567890abcdef',
    )
    assert.equal(screen.getByText('alice::party').textContent, 'alice::party')
    assert.equal(
      screen.getByText('TransferPendingReceiverAcceptance').textContent,
      'TransferPendingReceiverAcceptance',
    )
    assert.equal(screen.getByText('2026-06-09 20:41 UTC').textContent, '2026-06-09 20:41 UTC')
    assert.equal(screen.getByText('2026-06-10 20:41 UTC').textContent, '2026-06-10 20:41 UTC')
    assert.equal(screen.getByText('transfer-cid-1').textContent, 'transfer-cid-1')
  })

  it('enables Amulet auto-accept for the selected party', async () => {
    // Scenario: the selected party has no active Amulet receiver preapproval.
    // Enabling auto-accept must sign the prepared command for that same party.
    let createCalls = 0
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
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

    renderTransfers(transfersApi, preapprovalApi)

    await screen.findByText('Auto-accept')
    const toggle = await screen.findByRole('switch', { name: 'Auto-accept' })
    await waitFor(() => {
      assert.equal(toggle.hasAttribute('disabled'), false)
    })
    await userEvent.click(toggle)

    assert.equal(createCalls, 1)
  })

  it('flips the toggle on while the enable command is still settling', async () => {
    // Scenario: the preapproval can take seconds to land on the ledger. The switch
    // must show the requested state right away instead of waiting for the next poll.
    let resolveCreate: (() => void) | undefined
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
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

    renderTransfers(transfersApi, preapprovalApi)

    const toggle = await screen.findByRole('switch', { name: 'Auto-accept' })
    await waitFor(() => assert.equal(toggle.hasAttribute('disabled'), false))

    await userEvent.click(toggle)

    // Optimistic: reads as on before the ledger status has caught up.
    await waitFor(() => assert.equal(toggle.getAttribute('aria-checked'), 'true'))

    resolveCreate?.()
  })

  it('disables active Amulet auto-accept for the selected party', async () => {
    // Scenario: the selected party already has an active receiver preapproval.
    // The toggle reads as on and flipping it cancels the same receiver preapproval.
    let cancelCalls = 0
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
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

    renderTransfers(transfersApi, preapprovalApi)

    const toggle = await screen.findByRole('switch', { name: 'Auto-accept', checked: true })
    await userEvent.click(toggle)

    assert.equal(cancelCalls, 1)
  })

  it('reads expired Amulet auto-accept as on so it can be cleared', async () => {
    // Scenario: a preapproval contract can still exist after its expiry. The toggle
    // stays on so the user can flip it off to clear the stale preapproval.
    const transfersApi: Cip56TransferApi = {
      listPendingIncomingTransfers: async () => [],
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

    renderTransfers(transfersApi, preapprovalApi)

    const toggle = await screen.findByRole('switch', { name: 'Auto-accept', checked: true })
    assert.equal(toggle.getAttribute('aria-checked'), 'true')
  })
})
