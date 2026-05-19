import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { AutoLockList, PasswordForm } from '@/components/SecurityPanel.tsx'
import { TooltipProvider } from '@/components/ui/Tooltip.tsx'
import { getToastEntries, toast } from '@/components/ui/toast.ts'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext.tsx'

const baseVault = (): VaultContextValue => ({
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
  recordTransaction: async () => ({}) as unknown as import('@/vault/types.ts').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
})

const renderWithVault = (overrides: Partial<VaultContextValue>, ui: ReactNode): void => {
  const value = { ...baseVault(), ...overrides }
  render(
    <TooltipProvider>
      <VaultContext.Provider value={value}>{ui}</VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('PasswordForm', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('starts in verify phase with only a current-password field', () => {
    renderWithVault({}, <PasswordForm />)
    assert.ok(screen.getByLabelText(/current password/i))
    assert.equal(screen.queryByLabelText(/new password/i), null)
  })

  it('shows an error for the wrong current password and stays in verify phase', async () => {
    const user = userEvent.setup()
    renderWithVault({ verifyPassword: () => false }, <PasswordForm />)
    await user.type(screen.getByLabelText(/current password/i), 'nope-nope-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    const input = screen.getByLabelText(/current password/i)
    assert.equal(input.getAttribute('aria-invalid'), 'true')
    assert.ok(screen.getByText(/incorrect password/i))
  })

  it('advances to change phase when the current password is correct', async () => {
    const user = userEvent.setup()
    renderWithVault({ verifyPassword: () => true }, <PasswordForm />)
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    assert.ok(screen.getByLabelText(/^new password$/i))
    assert.ok(screen.getByLabelText(/confirm new password/i))
  })

  it('keeps the change button disabled when passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithVault({ verifyPassword: () => true }, <PasswordForm />)
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'different-value')
    assert.equal(
      (screen.getByRole('button', { name: /change password/i }) as HTMLButtonElement).disabled,
      true,
    )
  })

  it('marks the confirm field aria-invalid when passwords do not match', async () => {
    const user = userEvent.setup()
    renderWithVault({ verifyPassword: () => true }, <PasswordForm />)
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'different-value')
    assert.equal(
      screen.getByLabelText(/confirm new password/i).getAttribute('aria-invalid'),
      'true',
    )
  })

  it('keeps the change button disabled for passwords under 9 characters', async () => {
    const user = userEvent.setup()
    renderWithVault({ verifyPassword: () => true }, <PasswordForm />)
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText(/^new password$/i), 'short')
    await user.type(screen.getByLabelText(/confirm new password/i), 'short')
    assert.equal(
      (screen.getByRole('button', { name: /change password/i }) as HTMLButtonElement).disabled,
      true,
    )
  })

  it('calls changePassword and returns to verify phase on success', async () => {
    const user = userEvent.setup()
    const calls: Array<[string, string]> = []
    renderWithVault(
      {
        verifyPassword: () => true,
        changePassword: async (a, b) => {
          calls.push([a, b])
        },
      },
      <PasswordForm />,
    )
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    assert.deepEqual(calls, [['right-right-1', 'purple-monkey-dishwasher-42']])
    const entries = getToastEntries()
    assert.equal(entries.length, 1)
    assert.equal(entries[0]?.variant, 'success')
    assert.equal(entries[0]?.message, 'Password updated.')
    assert.ok(screen.getByLabelText(/current password/i))
  })

  it('returns to verify phase and surfaces the error when changePassword rejects', async () => {
    const user = userEvent.setup()
    renderWithVault(
      {
        verifyPassword: () => true,
        changePassword: async () => {
          throw new Error('rotation failed')
        },
      },
      <PasswordForm />,
    )
    await user.type(screen.getByLabelText(/current password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /continue/i }))
    await user.type(screen.getByLabelText(/^new password$/i), 'purple-monkey-dishwasher-42')
    await user.type(screen.getByLabelText(/confirm new password/i), 'purple-monkey-dishwasher-42')
    await user.click(screen.getByRole('button', { name: /change password/i }))
    assert.ok(screen.getByText(/rotation failed/i))
    assert.ok(screen.getByLabelText(/current password/i))
    assert.equal(screen.queryByLabelText(/^new password$/i), null)
  })
})

describe('AutoLockList', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders all four options and marks the active row', () => {
    renderWithVault({ autoLockOption: '5m' }, <AutoLockList />)
    for (const label of [/^never$/i, /^1 minute$/i, /^5 minutes$/i, /^1 hour$/i]) {
      assert.ok(screen.getByRole('button', { name: label }))
    }
    const active = screen.getByRole('button', { name: /^5 minutes$/i })
    assert.equal(active.getAttribute('aria-current'), 'true')
  })

  it('calls setAutoLockOption when a row is tapped', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    renderWithVault(
      { autoLockOption: 'never', setAutoLockOption: (o) => calls.push(o) },
      <AutoLockList />,
    )
    await user.click(screen.getByRole('button', { name: /^1 minute$/i }))
    assert.deepEqual(calls, ['1m'])
  })
})
