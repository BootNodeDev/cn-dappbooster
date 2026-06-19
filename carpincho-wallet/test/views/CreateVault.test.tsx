import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { CreateVault } from '@/views/onboarding/CreateVault'

const baseVault = (): VaultContextValue => ({
  isLocked: false,
  isLoading: false,
  hasVault: false,
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
  exportVault: () => ({ v: 1, accounts: [] }) as import('@/vault/types').VaultEnvelope,
  importVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
  signMessage: async () => '',
  recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
})

const renderCreateVault = (overrides: Partial<VaultContextValue> = {}): void => {
  const value = { ...baseVault(), ...overrides }
  render(
    <TooltipProvider>
      <VaultContext.Provider value={value}>
        <CreateVault />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('CreateVault', () => {
  afterEach(() => {
    cleanup()
  })

  it('confirm field has no aria-invalid before the user types', () => {
    renderCreateVault()
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), null)
  })

  it('confirm field becomes aria-invalid when passwords do not match', async () => {
    const user = userEvent.setup()
    renderCreateVault()
    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), 'true')
  })

  it('confirm field clears aria-invalid when passwords match', async () => {
    const user = userEvent.setup()
    renderCreateVault()
    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'purple-monkey-dishwasher-42')
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), null)
  })

  it('submit button is disabled until password is strong enough, matches, and is acknowledged', async () => {
    const user = userEvent.setup()
    renderCreateVault()
    const button = screen.getByRole('button', { name: /^create$/i }) as HTMLButtonElement
    assert.equal(button.disabled, true)

    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'purple-monkey-dishwasher-42')
    assert.equal(button.disabled, true)

    await user.click(screen.getByLabelText(/i understand/i))
    assert.equal(button.disabled, false)
  })

  it('calls setup with the entered password on submit', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderCreateVault({
      setup: async (pw) => {
        calls.push(pw)
      },
    })

    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByLabelText(/i understand/i))
    await user.click(screen.getByRole('button', { name: /^create$/i }))

    assert.deepEqual(calls, ['purple-monkey-dishwasher-42'])
  })
})
