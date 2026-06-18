import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
    exportPrivateKey: () => '',
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

  it('opens wallet-service settings from the account step footer', async () => {
    // Scenario: after the password step creates the vault, the user may still need to point
    // Carpincho at a different wallet-service before creating the first Canton party.
    installWalletServiceStatus()

    // Render onboarding directly at step 2: the vault exists, but no account has been created yet.
    const user = userEvent.setup()
    renderFlow({ hasVault: true, accounts: [] })

    // The existing footer should report the configured wallet-service status on this step.
    await waitFor(() => assert.ok(screen.getByText('local')))

    // Opening the footer settings should show the same wallet-service URL field used after setup.
    await user.click(screen.getByRole('button', { name: 'Connection settings' }))
    assert.ok(screen.getByLabelText('Wallet-service RPC URL'))
  })
})
