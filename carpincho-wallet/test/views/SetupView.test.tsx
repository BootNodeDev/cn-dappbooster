import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TooltipProvider } from '@/components/ui/Tooltip.tsx'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext.tsx'
import { SetupView } from '@/views/SetupView.tsx'

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
  signMessage: async () => '',
  recordTransaction: async () => ({}) as unknown as import('@/vault/types.ts').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
})

const renderSetup = (overrides: Partial<VaultContextValue> = {}): void => {
  const value = { ...baseVault(), ...overrides }
  render(
    <TooltipProvider>
      <VaultContext.Provider value={value}>
        <SetupView />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('SetupView', () => {
  afterEach(() => {
    cleanup()
  })

  it('confirm field has no aria-invalid before the user types', () => {
    renderSetup()
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), null)
  })

  it('confirm field becomes aria-invalid when passwords do not match', async () => {
    const user = userEvent.setup()
    renderSetup()
    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'different')
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), 'true')
  })

  it('confirm field clears aria-invalid when passwords match', async () => {
    const user = userEvent.setup()
    renderSetup()
    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'purple-monkey-dishwasher-42')
    const confirm = screen.getByLabelText(/confirm password/i)
    assert.equal(confirm.getAttribute('aria-invalid'), null)
  })

  it('submit button is disabled until password is strong enough, matches, and is acknowledged', async () => {
    const user = userEvent.setup()
    renderSetup()
    const button = screen.getByRole('button', { name: /create vault/i }) as HTMLButtonElement
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
    renderSetup({
      setup: async (pw) => {
        calls.push(pw)
      },
    })

    await user.type(screen.getByLabelText(/^password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByLabelText(/i understand/i))
    await user.click(screen.getByRole('button', { name: /create vault/i }))

    assert.deepEqual(calls, ['purple-monkey-dishwasher-42'])
  })
})
