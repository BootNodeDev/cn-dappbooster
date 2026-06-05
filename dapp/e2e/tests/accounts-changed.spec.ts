// End-to-end test for the wallet-pushed `accountsChanged` dapp-api event.
//
// The canonical extension transport (`WindowTransport` from
// `@canton-network/core-rpc-transport`) only carries request/response. Carpincho
// extends the protocol with a `SPLICE_WALLET_EVENT` message type that delivers
// wallet→page events through the existing content-script → page channel. The
// dApp wires the bridge in `extensionProvider.ts` and the canonical
// `client.onAccountsChanged(listener)` API just works.
//
// What this test exercises:
//   1. Set up Carpincho's vault from a clean state
//   2. Create two parties so we have something to switch between
//   3. Connect the dApp via the injected provider (active party = first created)
//   4. Open Carpincho's account picker and switch the primary to party #2
//   5. Verify the dApp's connected-party indicator updates without a refresh
//
// If anyone breaks the broadcast chain (vault → background → content script →
// page → provider.emit), the dApp won't notice the switch and this test fails.

import { connectViaExtension, onboardWallet } from '../fixtures/onboarding.ts'
import { DAPP_URL, expect, test } from '../fixtures/stack.ts'

const FIRST_PARTY = `e2e-ac-first-${Date.now().toString(36)}`
const SECOND_PARTY = `e2e-ac-second-${Date.now().toString(36)}`

test('accountsChanged propagates from Carpincho setPrimary to the dApp', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(90_000)

  // 1-2a. Vault setup + first party (becomes primary automatically).
  const wallet = await context.newPage()
  await onboardWallet(wallet, extensionId, FIRST_PARTY)

  // 2b. Second party — created via the Accounts dialog, which stays open; close it.
  await wallet.getByTestId('home-active-account').click()
  await wallet.getByTestId('menu-add-account').click()
  await wallet.getByTestId('add-account-hint-input').fill(SECOND_PARTY)
  await wallet.getByTestId('add-account-submit').click()
  await expect(wallet.getByTestId('add-account-hint-input')).toBeHidden({ timeout: 15_000 })
  await wallet.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(wallet.getByTestId('accounts-dialog')).toBeHidden()
  // Active party should still be FIRST — creating a new account doesn't bump primary.
  await expect(wallet.getByTestId('home-active-account')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${FIRST_PARTY}::`),
  )

  // 3. dApp connects (picks up the current primary = FIRST).
  const dapp = await context.newPage()
  await dapp.goto(DAPP_URL)
  await connectViaExtension(dapp)
  // The visible connected-party marker is the stable post-connect surface. The
  // signing harness remains mounted for protocol tests, but it is intentionally
  // hidden from the user-facing UI.
  await expect(dapp.getByTestId('connected-party')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${FIRST_PARTY}::`),
  )

  // 4. Switch primary in Carpincho. setPrimary fires the broadcast.
  await wallet.bringToFront()
  await wallet.getByTestId('home-active-account').click()
  await wallet.locator(`[data-testid="account-item"][data-party-id^="${SECOND_PARTY}::"]`).click()
  await expect(wallet.getByTestId('home-active-account')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${SECOND_PARTY}::`),
  )

  // 5. dApp should react to accountsChanged and now show the SECOND party.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('connected-party')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${SECOND_PARTY}::`),
    { timeout: 10_000 },
  )
})
