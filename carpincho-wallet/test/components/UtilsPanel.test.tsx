import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type UtilsApi, UtilsPanel } from '@/components/UtilsPanel'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import type { ActiveContract } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const CONTRACT: ActiveContract = {
  contractId: 'cid-1',
  templateId: 'pkg:Module:Template',
  createArgument: { admin: 'alice::party' },
  createdOffset: 42,
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
    exportPrivateKey: () => '',
    exportVault: () => ({ v: 1, accounts: [] }) as import('@/vault/types').VaultEnvelope,
    importVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
    changePassword: async () => undefined,
    verifyPassword: () => true,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

const renderPanel = (api: UtilsApi): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault()}>
        <UtilsPanel
          account={ACCOUNT}
          api={api}
        />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('UtilsPanel', () => {
  afterEach(() => {
    cleanup()
    toast.clear()
  })

  it('opens Create in a modal, submits, and closes', async () => {
    const createCalls: Parameters<UtilsApi['createContract']>[0][] = []
    const api: UtilsApi = {
      createContract: async (params) => {
        createCalls.push(params)
        return { updateId: 'update-1', completionOffset: 42 }
      },
      exerciseContract: async () => ({ updateId: 'unused' }),
      listActiveContracts: async () => [],
    }
    renderPanel(api)

    await userEvent.click(screen.getByRole('button', { name: /Create contract/ }))
    await userEvent.type(screen.getByLabelText('Template ID'), 'pkg:Module:Template')
    fireEvent.change(screen.getByLabelText('Create arguments JSON'), {
      target: { value: JSON.stringify({ admin: 'alice::party' }) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create contract' }))
    await waitFor(() => assert.equal(createCalls.length, 1))

    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => assert.equal(screen.queryByLabelText('Template ID'), null))
  })

  it('drills into Active contracts and applies the template filter', async () => {
    const listCalls: Parameters<UtilsApi['listActiveContracts']>[0][] = []
    const api: UtilsApi = {
      createContract: async () => ({ updateId: 'unused' }),
      exerciseContract: async () => ({ updateId: 'unused' }),
      listActiveContracts: async (params) => {
        listCalls.push(params)
        return [CONTRACT]
      },
    }
    renderPanel(api)

    await userEvent.click(screen.getByRole('button', { name: /Active contracts/ }))
    await screen.findAllByText('cid-1')
    await userEvent.type(screen.getByLabelText('Filter template ID'), 'pkg:Module:Template')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh contracts' }))

    await waitFor(() =>
      assert.deepEqual(listCalls.at(-1), {
        partyId: 'alice::party',
        templateId: 'pkg:Module:Template',
      }),
    )
  })

  it('warns when there is no account', () => {
    render(
      <TooltipProvider>
        <VaultContext.Provider value={baseVault()}>
          <UtilsPanel
            api={{
              createContract: async () => ({ updateId: 'x' }),
              exerciseContract: async () => ({ updateId: 'x' }),
              listActiveContracts: async () => [],
            }}
          />
        </VaultContext.Provider>
      </TooltipProvider>,
    )
    assert.ok(screen.getByText(/create an account/i))
  })
})
