// End-to-end test for CIP-0103 signMessage via the injected provider.
//
// Walks the full user journey:
//   1. Set up the Carpincho vault from a clean extension state
//   2. Create a party (drives /admin/party/* via the wallet's add-account form)
//   3. Open the counter dApp and connect via the injected extension provider
//   4. Fill the "Sign message" demo input and click Sign
//   5. Approve in the Carpincho popup
//   6. Verify the dApp surfaces a non-empty base64 signature
//
// Spec invariants checked:
//   * client.signMessage({message: base64}) → {signature: base64}
//   * The signature is non-empty and looks like base64 (Ed25519 is 64 bytes → 88 chars)

import { DAPP_URL, expect, test } from '../fixtures/stack.ts'

const STRONG_PASSWORD = 'correct-horse-battery-staple-2025!'
const PARTY_HINT = `e2e-sign-${Date.now().toString(36)}`

test('signMessage round-trips a base64 signature through the injected provider', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(60_000)

  // 1. Open Carpincho's popup and set up a fresh vault.
  const wallet = await context.newPage()
  await wallet.goto(`chrome-extension://${extensionId}/index.html`)
  await wallet.getByTestId('setup-password').fill(STRONG_PASSWORD)
  await wallet.getByTestId('setup-confirm').fill(STRONG_PASSWORD)
  await wallet.getByTestId('setup-accept-warning').check()
  await wallet.getByTestId('setup-create-vault').click()

  // 2. Create the party — this exercises wallet-service /admin/party/{prepare,complete}.
  await wallet.getByTestId('home-create-account').click()
  await wallet.getByTestId('add-account-hint-input').fill(PARTY_HINT)
  await wallet.getByTestId('add-account-submit').click()
  // Sheet closes after `v.addAccount` resolves — vault is updated.
  await expect(wallet.getByTestId('add-account-hint-input')).toBeHidden({ timeout: 15_000 })
  // VaultContext.tsx tick-bump now propagates the new account reactively;
  // no reload required.
  await expect(wallet.getByTestId('home-active-account')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${PARTY_HINT}::`),
  )

  // 3. Open the dApp and connect via the injected provider.
  const dapp = await context.newPage()
  await dapp.goto(DAPP_URL)
  await dapp.getByTestId('connect-extension').click()
  await expect(dapp.getByTestId('signing-panel')).toBeVisible()

  // 4. Fill input + click Sign. The dApp encodes the message as base64 before sending.
  const message = 'verify this party owns the key'
  await dapp.getByTestId('sign-input').fill(message)
  await dapp.getByTestId('sign-message').click()

  // 5. Carpincho shows the pending-approval card; click Approve.
  await wallet.bringToFront()
  await expect(wallet.getByTestId('pending-approve')).toBeVisible()
  await wallet.getByTestId('pending-approve').click()

  // 6. dApp surfaces the signature.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('signature-output')).toBeVisible()
  const signature = await dapp.getByTestId('signature-output').getAttribute('data-signature')

  // Ed25519 signature is 64 bytes → 88 base64 chars including '=' padding.
  expect(signature).not.toBeNull()
  expect(signature!.length).toBe(88)
  expect(signature).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
})
