// End-to-end test for the canton-connect-kit wallet-lock UX.
//
// Carpincho can auto-lock the vault (idle timeout) or the user can lock it
// from the burger menu. Either way, the wallet emits `statusChanged` with
// `isConnected: false` through the SPLICE_WALLET_EVENT bus; the kit's
// `useWalletStatus().isLocked` flips true; the dApp replaces the workspace
// with a "Wallet locked — unlock Carpincho to continue" banner.
//
// Unlocking the wallet flips `isLocked` back via the `connected` /
// `statusChanged` follow-up and the dApp recovers automatically (workspace
// actions return, counters reload).
//
// This test drives a manual lock from Carpincho's burger menu rather than
// the idle timeout (faster, deterministic).

import { connectViaExtension, onboardWallet, STRONG_PASSWORD } from '../fixtures/onboarding.ts'
import { DAPP_URL, expect, test } from '../fixtures/stack.ts'

const PARTY_HINT = `e2e-lock-${Date.now().toString(36)}`

test('wallet lock surfaces in the dApp and unlock recovers', async ({ context, extensionId }) => {
  test.setTimeout(90_000)

  // Vault setup + party create.
  const wallet = await context.newPage()
  await onboardWallet(wallet, extensionId, PARTY_HINT)

  // dApp connect via the injected provider.
  const dapp = await context.newPage()
  await dapp.goto(DAPP_URL)
  await connectViaExtension(dapp)
  // The shell-owned `workspace-ready` marker proves the dApp is connected and
  // unlocked, independent of any removable feature (counter, sign-message, ...).
  await expect(dapp.getByTestId('workspace-ready')).toBeVisible()
  await expect(dapp.getByTestId('wallet-locked-banner')).toBeHidden()

  // Lock the wallet from the burger menu. Use exact-match name because
  // the account-dropdown trigger has aria-label="Open account menu" which
  // otherwise matches a fuzzy "Menu" search.
  await wallet.bringToFront()
  await wallet.getByRole('button', { name: 'Menu', exact: true }).click()
  await wallet.getByRole('button', { name: 'Log out', exact: true }).click()
  // Lock takes Carpincho back to the Unlock view; confirm the password input
  // is rendered.
  await expect(wallet.getByTestId('unlock-password')).toBeVisible()

  // dApp picks up the statusChanged broadcast and surfaces the locked UX.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('wallet-locked-banner')).toBeVisible({ timeout: 10_000 })
  await expect(dapp.getByTestId('workspace-ready')).toBeHidden()

  // Unlock the wallet.
  await wallet.bringToFront()
  await wallet.getByTestId('unlock-password').fill(STRONG_PASSWORD)
  await wallet.getByTestId('unlock-submit').click()
  await expect(wallet.getByTestId('home-active-account')).toBeVisible({ timeout: 10_000 })

  // dApp recovers automatically — banner goes away and workspace actions return.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('wallet-locked-banner')).toBeHidden({ timeout: 10_000 })
  await expect(dapp.getByTestId('workspace-ready')).toBeVisible()
})
