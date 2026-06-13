import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MockDarkPoolClient } from './MockDarkPoolClient.ts'

const LOCAL = 'alice'
const POOL = 'CC-TUSD'

describe('MockDarkPoolClient', () => {
  it('lists seeded pools', () => {
    const c = new MockDarkPoolClient(0)
    assert.equal(c.listPools().length, 2)
  })

  it('placeOrder adds to my orders and the book and declares funding', () => {
    const c = new MockDarkPoolClient(0)
    const before = c.getBalances(LOCAL).find((b) => b.label === 'TUSD')?.declared ?? -1
    return c
      .placeOrder(LOCAL, {
        poolId: POOL,
        side: 'Buy',
        limitPrice: 2.6,
        quantity: 8,
        minFill: 1,
        expiresAt: null,
      })
      .then((order) => {
        assert.ok(c.listMyOrders(LOCAL).some((o) => o.orderId === order.orderId))
        assert.ok(c.listBook(POOL).some((o) => o.orderId === order.orderId))
        const after = c.getBalances(LOCAL).find((b) => b.label === 'TUSD')?.declared ?? -1
        assert.equal(after, before + 20.8) // quoteAmount(8, 2.6)
      })
  })

  it('cancelOrder removes it and releases declared funding', async () => {
    const c = new MockDarkPoolClient(0)
    const order = await c.placeOrder(LOCAL, {
      poolId: POOL,
      side: 'Buy',
      limitPrice: 2.6,
      quantity: 8,
      minFill: 1,
      expiresAt: null,
    })
    await c.cancelOrder(LOCAL, order.orderId)
    assert.equal(
      c.listMyOrders(LOCAL).some((o) => o.orderId === order.orderId),
      false,
    )
    assert.equal(c.getBalances(LOCAL).find((b) => b.label === 'TUSD')?.declared, 0)
  })

  it('matchOrders settles at the midpoint, records a trade, and re-rests a remainder', async () => {
    const c = new MockDarkPoolClient(0)
    // seed s1 is carol Sell 8 @ 2.6
    const buy = await c.placeOrder(LOCAL, {
      poolId: POOL,
      side: 'Buy',
      limitPrice: 2.7,
      quantity: 10,
      minFill: 1,
      expiresAt: null,
    })
    const result = await c.matchOrders(buy.orderId, 's1')
    assert.equal(result.execPrice, 2.65) // midpoint(2.7, 2.6)
    assert.equal(result.fillQty, 8) // min(10, 8)
    assert.ok(result.buyRemainder) // 10 - 8 = 2 >= minFill 1
    assert.equal(c.listTrades(POOL)[0].quantity, 8)
    assert.ok(c.listMyFills(LOCAL).some((f) => f.quantity === 8 && f.side === 'Buy'))
  })

  it('matchOrders rejects non-crossing or same-side pairs', async () => {
    const c = new MockDarkPoolClient(0)
    const buyLow = await c.placeOrder(LOCAL, {
      poolId: POOL,
      side: 'Buy',
      limitPrice: 2.0,
      quantity: 8,
      minFill: 1,
      expiresAt: null,
    })
    await assert.rejects(() => c.matchOrders(buyLow.orderId, 's1')) // 2.0 < 2.6, no cross
  })

  it('returns a stable snapshot reference until a mutation, then a fresh one', async () => {
    const c = new MockDarkPoolClient(0)
    const a = c.listBook(POOL)
    const b = c.listBook(POOL)
    assert.equal(a, b)
    await c.placeOrder(LOCAL, {
      poolId: POOL,
      side: 'Buy',
      limitPrice: 2.6,
      quantity: 8,
      minFill: 1,
      expiresAt: null,
    })
    const d = c.listBook(POOL)
    assert.notEqual(a, d)
  })

  it('notifies subscribers on mutation', async () => {
    const c = new MockDarkPoolClient(0)
    let calls = 0
    const unsub = c.subscribe(() => {
      calls += 1
    })
    await c.placeOrder(LOCAL, {
      poolId: POOL,
      side: 'Sell',
      limitPrice: 2.4,
      quantity: 8,
      minFill: 1,
      expiresAt: null,
    })
    unsub()
    assert.ok(calls >= 1)
  })
})
