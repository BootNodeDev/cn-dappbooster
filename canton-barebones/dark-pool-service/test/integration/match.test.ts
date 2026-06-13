// End-to-end over the mock ledger (no Canton): faucet → place → match → settle,
// plus cancel and expiry sweep, driven through the real HTTP layer.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { loadConfig } from '../../src/config.ts'
import { createApp } from '../../src/http.ts'
import type { Balance } from '../../src/types.ts'
import { buildContext } from '../../src/wiring.ts'

const startApp = async () => {
  process.env.DARK_POOL_MOCK = '1'
  process.env.DARK_POOL_BOOTSTRAP = ''
  const config = loadConfig()
  const ctx = buildContext(config)
  await ctx.projection.refresh()
  const server = createApp(ctx).listen(0)
  await once(server, 'listening')
  const { port } = server.address() as AddressInfo
  return {
    base: `http://127.0.0.1:${port}`,
    parties: config.parties.traders,
    close: async () => {
      ctx.scheduler.stop()
      await new Promise((resolve) => server.close(() => resolve(undefined)))
    },
  }
}

const post = (base: string, path: string, body: unknown): Promise<Response> =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

const total = (balances: Balance[], symbol: string): string =>
  balances.find((balance) => balance.instrument.id === symbol)?.total ?? 'missing'

test('place a crossing buy/sell, match settles at the midpoint and moves balances', async () => {
  const app = await startApp()
  const { alice, bob } = app.parties
  try {
    await post(app.base, '/faucet', { party: alice, instrument: 'TTB', amount: '100.0' })
    await post(app.base, '/faucet', { party: bob, instrument: 'TTA', amount: '100.0' })

    const buy = await post(app.base, '/orders', {
      party: alice,
      poolId: 'TTA-TTB',
      side: 'Buy',
      quantity: '10.0',
      limitPrice: '2.0',
      minFill: '1.0',
    })
    assert.equal(buy.status, 201)
    const sell = await post(app.base, '/orders', {
      party: bob,
      poolId: 'TTA-TTB',
      side: 'Sell',
      quantity: '10.0',
      limitPrice: '1.0',
      minFill: '1.0',
    })
    assert.equal(sell.status, 201)

    const matchReport = await (await post(app.base, '/venue/match', {})).json()
    assert.equal(matchReport.matched.length, 1)
    assert.equal(matchReport.matched[0].price, '1.5000000000')
    assert.equal(matchReport.matched[0].qty, '10.0000000000')
    assert.equal(matchReport.matched[0].buyer, alice)
    assert.equal(matchReport.matched[0].seller, bob)

    const aliceView = await (
      await fetch(`${app.base}/trade?party=${encodeURIComponent(alice)}`)
    ).json()
    assert.equal(aliceView.fills.length, 1)
    assert.equal(aliceView.fills[0].side, 'Buy')
    // exec price is the 1.5 midpoint: alice pays 15 TTB and receives 10 TTA
    assert.equal(total(aliceView.balances, 'TTA'), '10.0000000000')
    assert.equal(total(aliceView.balances, 'TTB'), '85.0000000000')

    const venue = await (await fetch(`${app.base}/venue`)).json()
    assert.equal(venue.pools['TTA-TTB'].trades.length, 1)
    assert.equal(venue.pools['TTA-TTB'].book.length, 0)
  } finally {
    await app.close()
  }
})

test('cancel removes a resting order before it matches', async () => {
  const app = await startApp()
  const { alice } = app.parties
  try {
    await post(app.base, '/faucet', { party: alice, instrument: 'TTB', amount: '100.0' })
    const placed = await (
      await post(app.base, '/orders', {
        party: alice,
        side: 'Buy',
        quantity: '10.0',
        limitPrice: '2.0',
        minFill: '1.0',
      })
    ).json()
    const cancel = await fetch(`${app.base}/orders/${encodeURIComponent(placed.order.cid)}`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ party: alice }),
    })
    assert.equal(cancel.status, 200)
    const view = await (await fetch(`${app.base}/trade?party=${encodeURIComponent(alice)}`)).json()
    assert.equal(view.orders.length, 0)
  } finally {
    await app.close()
  }
})

test('a pass sweeps an expired order via Order_Reject', async () => {
  const app = await startApp()
  const { bob } = app.parties
  try {
    await post(app.base, '/faucet', { party: bob, instrument: 'TTA', amount: '100.0' })
    await post(app.base, '/orders', {
      party: bob,
      side: 'Sell',
      quantity: '10.0',
      limitPrice: '1.0',
      minFill: '1.0',
      expiresAt: Date.now() - 1000,
    })
    const report = await (await post(app.base, '/venue/match', {})).json()
    assert.equal(report.matched.length, 0)
    assert.ok(
      report.rejected.some((rejection: { reason: string }) => rejection.reason === 'expired'),
    )
  } finally {
    await app.close()
  }
})
