import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AccountCard } from '@/components/AccountCard'
import { TooltipProvider } from '@/components/ui/Tooltip'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const PRIMARY_ACCOUNT: AccountPublic = {
  id: 'primary-account',
  name: 'alice',
  partyId: 'party-primary-1234567890abcdef',
  publicKeyBase64: 'primary-public-key',
  network: 'localnet',
  isPrimary: true,
  createdAt: 1,
}
const SECONDARY_ACCOUNT: AccountPublic = {
  id: 'secondary-account',
  name: 'bob',
  partyId: 'party-secondary-1234567890abcdef',
  publicKeyBase64: 'secondary-public-key',
  network: 'localnet',
  isPrimary: false,
  createdAt: 2,
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
    accounts: [PRIMARY_ACCOUNT, SECONDARY_ACCOUNT],
    primary: PRIMARY_ACCOUNT,
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
    exportVault: () => ({ v: 1, accounts: [] }) as import('@/vault/types').VaultEnvelope,
    importVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
  }) as VaultContextValue

const renderCard = (): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault()}>
        <AccountCard primary={PRIMARY_ACCOUNT} />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('AccountCard header row', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders avatar/address, a copy button, and the chevron trigger (no rotating caret)', () => {
    renderCard()
    assert.ok(screen.getByTestId('home-active-account'))
    assert.ok(screen.getByTestId('account-copy-party-id'))
    assert.equal(screen.queryByTestId('account-menu-caret'), null)
  })

  it('opens the centered Accounts dialog when the chevron is clicked', async () => {
    const user = userEvent.setup()
    renderCard()
    assert.equal(screen.queryByRole('dialog'), null)
    await user.click(screen.getByTestId('home-active-account'))
    const dialog = await screen.findByRole('dialog')
    assert.ok((dialog.textContent ?? '').includes('Accounts'))
    assert.ok(screen.getByTestId('account-search'))
  })
})
