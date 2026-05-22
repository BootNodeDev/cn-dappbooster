// Smoke tests for the canton-counter integration stack.
//
// These tests deliberately do NOT exercise the full transaction flow — that's
// Phase 2 work. Here we only verify the cross-package wiring works:
//   * wallet-service responds with the post-Phase-1 surface
//   * Carpincho extension loads and announces via the discovery protocol
//   * Counter dApp page loads
//
// A failing smoke means the integration boundary is broken. Each test runs in
// well under a second once the stack is up.

import { test, expect, WALLET_SERVICE_URL, DAPP_URL } from '../fixtures/stack.ts'

test.describe('canton-counter integration smoke', () => {
  test('wallet-service /health responds with the configured service', async ({ request }) => {
    const response = await request.get(`${WALLET_SERVICE_URL}/health`)
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(body).toMatchObject({
      ok: true,
      service: 'wallet-service',
      network: 'canton:local'
    })
  })

  test('wallet-service /wallet-service/info exposes the post-Phase-1 surface', async ({ request }) => {
    const response = await request.get(`${WALLET_SERVICE_URL}/wallet-service/info`)
    expect(response.ok()).toBe(true)
    const body = await response.json() as Record<string, unknown>
    expect(body.supportedMethods).toEqual([
      'status',
      'connect',
      'disconnect',
      'isConnected',
      'getActiveNetwork',
      'listAccounts',
      'getPrimaryAccount',
      'ledgerApi',
      'prepareTransaction',
      'executePrepared'
    ])
    expect(body.adminEndpoints).toEqual([
      'POST /admin/party/prepare',
      'POST /admin/party/complete'
    ])
    expect(body.reservedMethods).toEqual([
      'prepareExecute',
      'prepareExecuteAndWait',
      'signMessage'
    ])
  })

  test('counter dApp loads and offers both connect paths', async ({ context }) => {
    const page = await context.newPage()
    await page.goto(DAPP_URL)
    await expect(page.getByTestId('connect-extension')).toBeVisible()
    await expect(page.getByTestId('connect-walletconnect')).toBeVisible()
  })

  test('Carpincho extension is discoverable from a dApp page via canton:requestProvider', async ({ context }) => {
    const page = await context.newPage()
    await page.goto(DAPP_URL)
    const announcement = await page.evaluate(() => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('extension did not announce within 3s')), 3_000)
      window.addEventListener('canton:announceProvider', (event) => {
        clearTimeout(timeout)
        resolve((event as CustomEvent<unknown>).detail)
      }, { once: true })
      window.dispatchEvent(new CustomEvent('canton:requestProvider'))
    }))
    expect(announcement).toMatchObject({
      id: 'carpincho-wallet',
      name: 'Carpincho Wallet'
    })
  })
})
