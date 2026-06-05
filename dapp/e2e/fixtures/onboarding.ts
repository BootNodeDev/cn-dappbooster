// Shared wallet-onboarding and dApp-connect steps for specs. Black-box:
// data-testid surfaces only, no source imports.

import { expect, type Page } from '@playwright/test'

export const STRONG_PASSWORD = 'correct-horse-battery-staple-2025!'

// Fresh-vault setup; the wizard flows straight into the create-account step.
export const onboardWallet = async (
  wallet: Page,
  extensionId: string,
  partyHint: string,
): Promise<void> => {
  await wallet.goto(`chrome-extension://${extensionId}/index.html`)
  await wallet.getByTestId('setup-password').fill(STRONG_PASSWORD)
  await wallet.getByTestId('setup-confirm').fill(STRONG_PASSWORD)
  await wallet.getByTestId('setup-accept-warning').check()
  await wallet.getByTestId('setup-create-vault').click()
  await wallet.getByTestId('add-account-hint-input').fill(partyHint)
  await wallet.getByTestId('add-account-submit').click()
  // Sheet closes once the party is allocated.
  await expect(wallet.getByTestId('add-account-hint-input')).toBeHidden({ timeout: 15_000 })
  await expect(wallet.getByTestId('home-active-account')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${partyHint}::`),
  )
}

// The disconnected hero offers extension connect directly.
export const connectViaExtension = async (dapp: Page): Promise<void> => {
  await dapp.getByTestId('hero-connect').click()
}
