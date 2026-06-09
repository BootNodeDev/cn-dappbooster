import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssetsPanel } from '@/components/AssetsPanel'
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

const renderAssets = (api: Cip56TransferApi): void => {
  render(
    <VaultContext.Provider value={baseVault()}>
      <AssetsPanel api={api} />
    </VaultContext.Provider>,
  )
}

describe('AssetsPanel', () => {
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

    renderAssets(api)

    await screen.findByText('Incoming transfers')
    await screen.findByText('42 Amulet')
    await userEvent.click(screen.getByRole('button', { name: 'Accept' }))
    await waitFor(() => assert.ok(screen.getByText('No pending transfers')))

    assert.deepEqual(calls, ['list', 'accept', 'list'])
  })
})
