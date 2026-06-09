import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IncomingTransfersSection } from '@/components/IncomingTransfersSection'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
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
const renderIncomingTransfers = (api: Cip56TransferApi): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <IncomingTransfersSection api={api} />
    </VaultContext.Provider>,
  )
}

describe('IncomingTransfersSection', () => {
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

    renderIncomingTransfers(api)

    await screen.findByText('Incoming transfers')
    await screen.findByText('42 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.ok(screen.getByText('No pending transfers')))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
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

    renderIncomingTransfers(api)

    await screen.findByText('666.0000000000 Amulet')
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
})
