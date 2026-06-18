import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { Header } from '@/components/Header'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

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
  exportPrivateKey: () => '',
  signMessage: async () => '',
  recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
  ...overrides,
})

const wrap = (value: VaultContextValue, ui: ReactNode): JSX.Element => (
  <ThemeProvider>
    <VaultContext.Provider value={value}>{ui}</VaultContext.Provider>
  </ThemeProvider>
)

describe('Header', () => {
  afterEach(() => {
    cleanup()
  })

  it('no longer renders the Lock wallet button', () => {
    render(wrap(baseVault(), <Header onOpenMenu={() => undefined} />))
    assert.equal(screen.queryByRole('button', { name: /lock wallet/i }), null)
  })

  it('renders a Menu button that calls onOpenMenu', async () => {
    const user = userEvent.setup()
    let calls = 0
    render(
      wrap(
        baseVault(),
        <Header
          onOpenMenu={() => {
            calls += 1
          }}
        />,
      ),
    )
    await user.click(screen.getByRole('button', { name: /menu/i }))
    assert.equal(calls, 1)
  })
})
