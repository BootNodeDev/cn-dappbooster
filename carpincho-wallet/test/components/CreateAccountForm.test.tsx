import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateAccountForm } from '@/components/CreateAccountForm'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: () => undefined,
    accounts: [],
    primary: null,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ({
      id: '',
      name: '',
      partyId: '',
      publicKeyBase64: '',
      network: '',
      isPrimary: false,
      createdAt: 0,
    }),
    removeAccount: async () => undefined,
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
    ...overrides,
  }) as VaultContextValue

const renderForm = (
  props: Partial<import('@/components/CreateAccountForm').CreateAccountFormProps> = {},
  vaultOverrides: Partial<VaultContextValue> = {},
): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(vaultOverrides)}>
        <CreateAccountForm {...props} />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateAccountForm', () => {
  afterEach(() => {
    cleanup()
  })

  it('rejects an invalid party hint without creating an account', async () => {
    const user = userEvent.setup()
    const added: unknown[] = []
    renderForm(
      {},
      {
        addAccount: async (args) => {
          added.push(args)
          return {
            id: '',
            name: '',
            partyId: '',
            publicKeyBase64: '',
            network: '',
            isPrimary: false,
            createdAt: 0,
          }
        },
      },
    )

    await user.type(screen.getByTestId('add-account-hint-input'), 'AB')
    await user.click(screen.getByTestId('add-account-submit'))

    assert.ok(screen.getByText(/3.{1,3}64 lowercase/i))
    assert.equal(added.length, 0)
  })

  it('renders a Cancel button only when onCancel is provided', () => {
    renderForm({ onCancel: () => undefined })
    assert.ok(screen.queryByTestId('add-account-cancel'))
    cleanup()
    renderForm({})
    assert.equal(screen.queryByTestId('add-account-cancel'), null)
  })

  it('invokes onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup()
    let cancelled = false
    renderForm({
      onCancel: () => {
        cancelled = true
      },
    })
    await user.click(screen.getByTestId('add-account-cancel'))
    assert.equal(cancelled, true)
  })

  it('uses the provided submit label', () => {
    renderForm({ submitLabel: 'Create your account' })
    assert.ok(screen.getByRole('button', { name: 'Create your account' }))
  })
})

describe('CreateAccountForm pipeline wiring', () => {
  const source = (): string => readFileSync('src/components/CreateAccountForm.tsx', 'utf8')

  it('runs prepare -> sign -> complete -> addAccount and calls onSuccess', () => {
    const src = source()
    assert.match(src, /prepareCreateParty\(/)
    assert.match(src, /signMessageBase64\(kp\.privateKeyHex, prepared\.multiHash\)/)
    assert.match(src, /completeCreateParty\(/)
    assert.match(src, /await v\.addAccount\(/)
    assert.match(src, /onSuccess\?\.\(\)/)
  })
})
