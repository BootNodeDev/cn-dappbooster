import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen } from '@testing-library/react'
import { TooltipProvider } from '@/components/ui/Tooltip.tsx'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext.tsx'
import { OnboardingFlow } from '@/views/onboarding/OnboardingFlow.tsx'

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
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types.ts').TransactionRecord,
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

describe('OnboardingFlow', () => {
  afterEach(() => {
    cleanup()
  })

  it('shows step 1 (create vault) active when there is no vault', () => {
    renderFlow({ hasVault: false })
    assert.ok(screen.getByRole('button', { name: /create vault/i }))
    assert.equal(screen.getByTestId('step-1').getAttribute('aria-current'), 'step')
    assert.equal(screen.getByTestId('step-2').getAttribute('data-state'), 'upcoming')
  })

  it('shows step 2 (create account) active with step 1 complete when the vault has no accounts', () => {
    renderFlow({ hasVault: true, accounts: [] })
    assert.ok(screen.getByTestId('add-account-hint-input'))
    assert.equal(screen.getByTestId('step-1').getAttribute('data-state'), 'complete')
    assert.equal(screen.getByTestId('step-2').getAttribute('aria-current'), 'step')
  })

  it('does not render a Cancel control on the account step', () => {
    renderFlow({ hasVault: true, accounts: [] })
    assert.equal(screen.queryByTestId('add-account-cancel'), null)
  })
})
