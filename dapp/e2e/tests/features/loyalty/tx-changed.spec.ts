// End-to-end test for the wallet-pushed `txChanged` dapp-api event lifecycle.
//
// Carpincho's pending-approval flow orchestrates: prepareTransaction (wallet-
// service) → local sign with the vault key → executePrepared (wallet-service).
// Per the dapp-api spec, the wallet should emit `txChanged` events at each
// transition: pending → signed → executed (or failed).
//
// We can't easily assert each transient `pending`/`signed` from the dApp DOM
// because they fire within ~hundreds of ms. The deterministic invariant is:
// after a successful prepareExecuteAndWait, the dApp surfaces `executed` and
// the commandId it dispatched. The pending/signed events are validated by a
// JS-side capture installed before the action.

import { connectViaExtension, onboardWallet } from '../../../fixtures/onboarding.ts'
import { DAPP_URL, expect, test } from '../../../fixtures/stack.ts'

const PARTY_HINT = `e2e-tx-${Date.now().toString(36)}`

test('txChanged lifecycle reaches the dApp during prepareExecuteAndWait', async ({
  context,
  extensionId,
}) => {
  test.setTimeout(90_000)

  // Vault setup + party create.
  const wallet = await context.newPage()
  await onboardWallet(wallet, extensionId, PARTY_HINT)

  // dApp connect.
  const dapp = await context.newPage()
  await dapp.goto(DAPP_URL)
  await connectViaExtension(dapp)
  // The visible New card action is the connected, unlocked workspace state
  // that can dispatch prepareExecuteAndWait.
  await expect(dapp.getByTestId('new-card')).toBeVisible()

  // Install a capture for all SPLICE_WALLET_EVENT messages with eventName=txChanged
  // BEFORE clicking the button — otherwise the pending/signed events that fire
  // before the user-visible "executed" state get missed.
  await dapp.evaluate(() => {
    ;(window as unknown as { __txEvents: unknown[] }).__txEvents = []
    window.addEventListener('message', (event: MessageEvent) => {
      const data = event.data as { type?: string; eventName?: string; payload?: unknown } | null
      if (data?.type === 'SPLICE_WALLET_EVENT' && data?.eventName === 'txChanged') {
        ;(window as unknown as { __txEvents: unknown[] }).__txEvents.push(data.payload)
      }
    })
  })

  // Trigger a transaction. "New card" exercises prepareExecuteAndWait.
  await dapp.getByTestId('new-card').click()

  // Approve in Carpincho.
  await wallet.bringToFront()
  await expect(wallet.getByTestId('pending-approve')).toBeVisible()
  await wallet.getByTestId('pending-approve').click()

  // Wait for the dApp to surface the executed status.
  await dapp.bringToFront()
  await expect(dapp.getByTestId('tx-status')).toHaveAttribute('data-tx-status', 'executed', {
    timeout: 30_000,
  })

  // Pull the captured event sequence and assert the spec-shaped lifecycle.
  const captured = await dapp.evaluate(
    () =>
      (window as unknown as { __txEvents: Array<{ status?: string; commandId?: string }> })
        .__txEvents,
  )
  const statuses = captured.map((e) => e.status)
  expect(statuses).toEqual(['pending', 'signed', 'executed'])

  // commandId should be consistent across all three events for this transaction.
  const commandIds = new Set(captured.map((e) => e.commandId))
  expect(commandIds.size).toBe(1)
  const onlyId = [...commandIds][0]
  expect(typeof onlyId).toBe('string')
  expect((onlyId as string).length).toBeGreaterThan(0)
})
