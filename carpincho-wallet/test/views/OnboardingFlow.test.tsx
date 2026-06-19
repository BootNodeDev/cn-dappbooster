import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'
import { OnboardingFlow } from '@/views/onboarding/OnboardingFlow'

const originalFetch = globalThis.fetch

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
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
    ...overrides,
  }) as VaultContextValue

const renderFlow = (overrides: Partial<VaultContextValue> = {}): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(overrides)}>
        <OnboardingFlow />
      </VaultContext.Provider>
    </TooltipProvider>,
  )
}

// Installs a healthy wallet-service status response so onboarding can render the real footer state.
const installWalletServiceStatus = (): void => {
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        result: {
          connection: { isNetworkConnected: true },
          network: { networkId: 'canton:local' },
        },
      }),
      { status: 200 },
    )
}

describe('OnboardingFlow', () => {
  afterEach(() => {
    cleanup()
    localStorage.clear()
    globalThis.fetch = originalFetch
  })

  it('shows step 1 (create vault) active when there is no vault', () => {
    renderFlow({ hasVault: false })
    assert.ok(screen.getByRole('button', { name: /^create$/i }))
    assert.equal(screen.getByTestId('step-1').getAttribute('aria-current'), 'step')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'upcoming')
  })

  it('shows step 2 (create account) active with step 1 complete when the vault has no accounts', () => {
    // Step 2 owns the live footer, so status polling is isolated from the test environment.
    installWalletServiceStatus()

    renderFlow({ hasVault: true, accounts: [] })
    assert.ok(screen.getByTestId('add-account-hint-input'))
    assert.equal(screen.getByTestId('step-1').getAttribute('data-state'), 'complete')
    assert.equal(screen.getByTestId('step-2').getAttribute('aria-current'), 'step')
  })

  it('does not render a Cancel control on the account step', () => {
    // The connection footer is present, but the account form should remain a one-action setup flow.
    installWalletServiceStatus()

    renderFlow({ hasVault: true, accounts: [] })
    assert.equal(screen.queryByTestId('add-account-cancel'), null)
  })

  it('does not render the connection footer on the account step', () => {
    // Connection config moved to its own onboarding step, so the account step is just the form.
    installWalletServiceStatus()

    renderFlow({ hasVault: true, accounts: [] })

    // The "Connection settings" button should not be present since the footer is gone.
    assert.equal(screen.queryByRole('button', { name: 'Connection settings' }), null)
  })
})
