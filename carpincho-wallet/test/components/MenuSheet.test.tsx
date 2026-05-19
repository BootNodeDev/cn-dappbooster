import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { type ReactNode, useState } from 'react'
import { MenuSheet } from '@/components/MenuSheet.tsx'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext.tsx'

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue => ({
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
  ...overrides,
})

const wrap = (value: VaultContextValue, ui: ReactNode): JSX.Element => (
  <VaultContext.Provider value={value}>{ui}</VaultContext.Provider>
)

describe('MenuSheet', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the root menu items when open', () => {
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    assert.ok(screen.getByRole('button', { name: /security & password/i }))
    assert.ok(screen.getByRole('button', { name: /log out/i }))
  })

  it('renders nothing when closed', () => {
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={false}
          onOpenChange={() => undefined}
        />,
      ),
    )
    assert.equal(screen.queryByRole('button', { name: /security & password/i }), null)
  })

  it('navigates to security and back', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /security & password/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
    assert.ok(screen.getByRole('button', { name: /^auto-lock$/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByRole('button', { name: /log out/i }))
  })

  it('drills into the password leaf and back returns to security', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault(),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /security & password/i }))
    await user.click(screen.getByRole('button', { name: /^password$/i }))
    assert.ok(screen.getByLabelText(/current password/i))
    await user.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
    assert.ok(screen.getByRole('button', { name: /^auto-lock$/i }))
  })

  it('drills into the auto-lock leaf and back returns to security', async () => {
    const user = userEvent.setup()
    render(
      wrap(
        baseVault({ autoLockOption: '5m' }),
        <MenuSheet
          open={true}
          onOpenChange={() => undefined}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /security & password/i }))
    await user.click(screen.getByRole('button', { name: /^auto-lock$/i }))
    assert.ok(screen.getByRole('button', { name: /^5 minutes$/i }))
    await user.click(screen.getByRole('button', { name: /back/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
  })

  it('log out calls vault.lock and closes the sheet', async () => {
    const user = userEvent.setup()
    let lockCalls = 0
    const openChanges: boolean[] = []
    render(
      wrap(
        baseVault({
          lock: () => {
            lockCalls += 1
          },
        }),
        <MenuSheet
          open={true}
          onOpenChange={(o) => openChanges.push(o)}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /log out/i }))
    assert.equal(lockCalls, 1)
    assert.deepEqual(openChanges, [false])
  })

  it('re-opening after closing resets to root menu', async () => {
    const user = userEvent.setup()
    const Harness = (): JSX.Element => {
      const [open, setOpen] = useState(true)
      return (
        <>
          <button
            type="button"
            onClick={() => setOpen(true)}
          >
            reopen
          </button>
          {wrap(
            baseVault(),
            <MenuSheet
              open={open}
              onOpenChange={setOpen}
            />,
          )}
        </>
      )
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: /security & password/i }))
    assert.ok(screen.getByRole('button', { name: /^password$/i }))
    await user.click(screen.getByRole('button', { name: /close/i }))
    await user.click(screen.getByRole('button', { name: /reopen/i }))
    assert.ok(screen.getByRole('button', { name: /security & password/i }))
  })
})
