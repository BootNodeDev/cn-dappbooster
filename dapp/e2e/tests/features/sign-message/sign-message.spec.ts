// End-to-end test for CIP-0103 signMessage via the injected provider.
//
// Walks the full user journey:
//   1. Set up the Carpincho vault from a clean extension state
//   2. Create a party (drives /admin/party/* via the wallet's add-account form)
//   3. Open the dApp and connect via the injected extension provider
//   4. Fill the "Sign message" demo input and click Sign
//   5. Approve in the Carpincho popup
//   6. Verify the dApp surfaces a non-empty base64 signature
//
// Spec invariants checked:
//   * client.signMessage({message: base64}) → {signature: base64}
//   * The signature is non-empty and looks like base64 (Ed25519 is 64 bytes → 88 chars)

import { connectViaExtension, onboardWallet } from '../../../fixtures/onboarding.ts'
import { DAPP_URL, expect, test } from '../../../fixtures/stack.ts'

const PARTY_HINT = `e2e-sign-${Date.now().toString(36)}`

test('signMessage round-trips a base64 signature through the injected provider', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(60_000)

  // 1-2. Vault setup + party create — exercises wallet-service /admin/party/{prepare,complete}.
  const wallet = await context.newPage()
  await onboardWallet(wallet, extensionId, PARTY_HINT)

  // 3. Open the standalone signMessage example page and connect via the provider.
  const dapp = await context.newPage()
  await dapp.goto(`${DAPP_URL}/sign-demo`)
  await connectViaExtension(dapp)
  await expect(dapp.getByTestId('connected-party')).toHaveAttribute(
    'data-party-id',
    new RegExp(`^${PARTY_HINT}::`),
  )

  // 4. Fill the message and click Sign.
  const message = 'verify this party owns the key'
  await dapp.getByTestId('sign-input').fill(message)
  await dapp.getByTestId('sign-message').click()

  // 5. Carpincho shows the pending-approval card; click Approve.
  await wallet.bringToFront()
  await expect(wallet.getByTestId('pending-approve')).toBeVisible()
  await wallet.getByTestId('pending-approve').click()

  // 6. dApp records the returned signature.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('signature-output')).toHaveAttribute(
    'data-signature',
    /^[A-Za-z0-9+/]+={0,2}$/,
  )
  const signature = await dapp.getByTestId('signature-output').getAttribute('data-signature')

  // Ed25519 signature is 64 bytes → 88 base64 chars including '=' padding.
  expect(signature).not.toBeNull()
  expect(signature!.length).toBe(88)
  expect(signature).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
})
