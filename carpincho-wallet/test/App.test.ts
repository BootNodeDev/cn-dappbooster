import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { selectShellView } from '@/App'
import type { VaultContextValue } from '@/vault/VaultContext'

type RoutingState = Pick<VaultContextValue, 'isLoading' | 'hasVault' | 'isLocked' | 'accounts'>

const state = (overrides: Partial<RoutingState> = {}): RoutingState => ({
  isLoading: false,
  hasVault: false,
  isLocked: false,
  accounts: [],
  ...overrides,
})

const oneAccount = [{}] as VaultContextValue['accounts']

describe('selectShellView routing', () => {
  it('shows the loading view while the vault is still resolving', () => {
    assert.equal(selectShellView(state({ isLoading: true, hasVault: true })), 'loading')
  })

  it('routes a first-run user (no vault) to onboarding', () => {
    assert.equal(selectShellView(state({ hasVault: false })), 'onboarding')
  })

  it('routes a locked existing vault to the unlock view', () => {
    assert.equal(
      selectShellView(state({ hasVault: true, isLocked: true, accounts: oneAccount })),
      'unlock',
    )
  })

  it('routes an unlocked vault with no accounts back to onboarding (step 2)', () => {
    assert.equal(
      selectShellView(state({ hasVault: true, isLocked: false, accounts: [] })),
      'onboarding',
    )
  })

  it('routes a returning user (unlocked vault, >= 1 account) to home', () => {
    assert.equal(
      selectShellView(state({ hasVault: true, isLocked: false, accounts: oneAccount })),
      'home',
    )
  })

  it('treats no-vault as onboarding regardless of the lock flag', () => {
    assert.equal(selectShellView(state({ hasVault: false, isLocked: true })), 'onboarding')
  })
})
