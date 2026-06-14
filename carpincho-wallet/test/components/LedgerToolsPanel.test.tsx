import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type LedgerToolsApi, LedgerToolsPanel } from '@/components/LedgerToolsPanel'
import { toast } from '@/components/ui/toast'
import type { ActiveContract } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const ACCOUNT: AccountPublic = {
  // Active account fixture represents the party whose vault key signs generic create commands.
  id: 'account-1',
  name: 'Alice',
  partyId: 'alice::party',
  publicKeyBase64: 'pk',
  network: 'canton:local',
  isPrimary: true,
  createdAt: 1,
}

const CONTRACT: ActiveContract = {
  // ACS fixture is the contract row the Contracts tab should render after a refresh.
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
    signMessage: async () => 'signature',
    recordTransaction: async (tx) => ({ ...tx, id: 'tx-1', createdAt: 1 }),
    changePassword: async () => undefined,
    verifyPassword: () => true,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

const renderPanel = (api: LedgerToolsApi, vault = baseVault()): void => {
  render(
    <VaultContext.Provider value={vault}>
      <LedgerToolsPanel
        account={ACCOUNT}
        api={api}
      />
    </VaultContext.Provider>,
  )
}

describe('LedgerToolsPanel', () => {
  afterEach(() => {
    // The panel emits toasts and owns form state, so reset the DOM and toast store per scenario.
    cleanup()
    toast.clear()
  })

  it('creates a contract from raw JSON and refreshes active contracts afterward', async () => {
    // Scenario: a developer pastes a DAML template id and create arguments.
    // Submitting should call the generic create helper with the active account and then refresh ACS
    // so the newly visible contract id appears in the Contracts tab.
    const createCalls: Parameters<LedgerToolsApi['createContract']>[0][] = []
    const listCalls: Parameters<LedgerToolsApi['listActiveContracts']>[0][] = []
    const api: LedgerToolsApi = {
      createContract: async (params) => {
        createCalls.push(params)
        return { updateId: 'update-1', completionOffset: 42 }
      },
      exerciseContract: async () => ({ updateId: 'unused' }),
      listActiveContracts: async (params) => {
        listCalls.push(params)
        return [CONTRACT]
      },
    }
    renderPanel(api)

    await userEvent.type(screen.getByLabelText('Template ID'), 'pkg:Module:Template')
    fireEvent.change(screen.getByLabelText('Create arguments JSON'), {
      target: { value: JSON.stringify({ admin: 'alice::party' }) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create contract' }))

    await waitFor(() => assert.equal(createCalls.length, 1))
    assert.equal(createCalls[0]?.account.partyId, 'alice::party')
    assert.equal(createCalls[0]?.templateId, 'pkg:Module:Template')
    assert.deepEqual(createCalls[0]?.createArguments, { admin: 'alice::party' })
    assert.equal(listCalls[0]?.partyId, 'alice::party')

    await userEvent.click(screen.getByRole('tab', { name: 'Contracts' }))

    assert.equal(screen.getByText('cid-1').textContent, 'cid-1')
    assert.ok(screen.getByText(/"admin": "alice::party"/))
  })

  it('formats loose create arguments before submitting the command', async () => {
    // Scenario: create payloads are often copied from DAML-like notes, not strict JSON.
    // The textarea should accept unquoted keys and newline-separated fields, normalize the
    // text to strict formatted JSON, and submit the parsed object to the ledger helper.
    const createCalls: Parameters<LedgerToolsApi['createContract']>[0][] = []
    const api: LedgerToolsApi = {
      createContract: async (params) => {
        createCalls.push(params)
        return { updateId: 'update-1', completionOffset: 42 }
      },
      exerciseContract: async () => ({ updateId: 'unused' }),
      listActiveContracts: async () => [],
    }
    renderPanel(api)

    await userEvent.type(screen.getByLabelText('Template ID'), 'pkg:Module:Template')
    const textarea = screen.getByLabelText('Create arguments JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: {
        value: `{
          owner: alice::party
          instrumentId: {
            admin: admin::party
            id: BNT
          }
        }`,
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Create contract' }))

    await waitFor(() => assert.equal(createCalls.length, 1))
    assert.deepEqual(createCalls[0]?.createArguments, {
      owner: 'alice::party',
      instrumentId: { admin: 'admin::party', id: 'BNT' },
    })
    assert.equal(
      textarea.value,
      JSON.stringify(
        {
          owner: 'alice::party',
          instrumentId: { admin: 'admin::party', id: 'BNT' },
        },
        null,
        2,
      ),
    )
  })

  it('refreshes active contracts with an optional template filter', async () => {
    // Scenario: the active party can own many contracts, so the Contracts tab has an optional
    // template-id filter. Refresh should pass that filter to the generic ACS helper.
    const listCalls: Parameters<LedgerToolsApi['listActiveContracts']>[0][] = []
    const api: LedgerToolsApi = {
      createContract: async () => ({ updateId: 'unused' }),
      exerciseContract: async () => ({ updateId: 'unused' }),
      listActiveContracts: async (params) => {
        listCalls.push(params)
        return [CONTRACT]
      },
    }
    renderPanel(api)

    await userEvent.click(screen.getByRole('tab', { name: 'Contracts' }))
    await userEvent.type(screen.getByLabelText('Filter template ID'), 'pkg:Module:Template')
    await userEvent.click(screen.getByRole('button', { name: 'Refresh contracts' }))

    await waitFor(() =>
      assert.deepEqual(listCalls.at(-1), {
        partyId: 'alice::party',
        templateId: 'pkg:Module:Template',
      }),
    )
    assert.equal(screen.getByText('cid-1').textContent, 'cid-1')
  })

  it('exercises a choice from raw JSON and refreshes active contracts afterward', async () => {
    // Scenario: a developer wants to call any known DAML choice by hand.
    // Submitting should forward template id, contract id, choice name, and parsed JSON body
    // to the generic exercise helper using the active account.
    const exerciseCalls: Parameters<LedgerToolsApi['exerciseContract']>[0][] = []
    const listCalls: Parameters<LedgerToolsApi['listActiveContracts']>[0][] = []
    const api: LedgerToolsApi = {
      createContract: async () => ({ updateId: 'unused' }),
      exerciseContract: async (params) => {
        exerciseCalls.push(params)
        return { updateId: 'exercise-update-1', completionOffset: 43 }
      },
      listActiveContracts: async (params) => {
        listCalls.push(params)
        return [CONTRACT]
      },
    }
    renderPanel(api)

    await userEvent.click(screen.getByRole('tab', { name: 'Exercise' }))
    await userEvent.type(screen.getByLabelText('Exercise template ID'), 'pkg:Module:Template')
    await userEvent.type(screen.getByLabelText('Contract ID'), 'cid-1')
    await userEvent.type(screen.getByLabelText('Choice'), 'Template_DoThing')
    fireEvent.change(screen.getByLabelText('Choice argument JSON'), {
      target: { value: JSON.stringify({ receiver: 'bob::party', amount: '5.0' }) },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Exercise choice' }))

    await waitFor(() => assert.equal(exerciseCalls.length, 1))
    assert.equal(exerciseCalls[0]?.account.partyId, 'alice::party')
    assert.equal(exerciseCalls[0]?.templateId, 'pkg:Module:Template')
    assert.equal(exerciseCalls[0]?.contractId, 'cid-1')
    assert.equal(exerciseCalls[0]?.choice, 'Template_DoThing')
    assert.deepEqual(exerciseCalls[0]?.choiceArgument, { receiver: 'bob::party', amount: '5.0' })
    assert.equal(listCalls.at(-1)?.partyId, 'alice::party')
  })

  it('formats loose choice arguments before exercising the choice', async () => {
    // Scenario: choice payloads have the same raw-entry workflow as create payloads.
    // The Exercise tab should normalize shorthand JSON before calling the generic choice
    // helper so the ledger sees a real object, not pasted source text.
    const exerciseCalls: Parameters<LedgerToolsApi['exerciseContract']>[0][] = []
    const api: LedgerToolsApi = {
      createContract: async () => ({ updateId: 'unused' }),
      exerciseContract: async (params) => {
        exerciseCalls.push(params)
        return { updateId: 'exercise-update-1', completionOffset: 43 }
      },
      listActiveContracts: async () => [],
    }
    renderPanel(api)

    await userEvent.click(screen.getByRole('tab', { name: 'Exercise' }))
    await userEvent.type(screen.getByLabelText('Exercise template ID'), 'pkg:Module:Template')
    await userEvent.type(screen.getByLabelText('Contract ID'), 'cid-1')
    await userEvent.type(screen.getByLabelText('Choice'), 'Template_DoThing')
    const textarea = screen.getByLabelText('Choice argument JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, {
      target: {
        value: `{
          receiver: bob::party
          transfer: {
            instrument: BNT
            amount: 5.5
          }
        }`,
      },
    })
    await userEvent.click(screen.getByRole('button', { name: 'Exercise choice' }))

    await waitFor(() => assert.equal(exerciseCalls.length, 1))
    assert.deepEqual(exerciseCalls[0]?.choiceArgument, {
      receiver: 'bob::party',
      transfer: { instrument: 'BNT', amount: 5.5 },
    })
    assert.equal(
      textarea.value,
      JSON.stringify(
        {
          receiver: 'bob::party',
          transfer: { instrument: 'BNT', amount: 5.5 },
        },
        null,
        2,
      ),
    )
  })
})
