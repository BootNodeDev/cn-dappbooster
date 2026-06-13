import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { MockDarkPoolClient } from './MockDarkPoolClient.ts'

const LOCAL = 'alice'

describe('MockDarkPoolClient', () => {
  it('lists seeded pools', () => {
    const c = new MockDarkPoolClient(0)
    assert.equal(c.listPools().length, 2)
  })

  it('placeOrder adds to my orders and the book and declares funding', () => {
    const c = new MockDarkPoolClient(0)
    const before = c.getBalances(LOCAL).find((b) => b.label === 'USDCx')?.declared ?? -1
    return c
      .placeOrder(LOCAL, {
        poolId: 'cBTC-USDCx',
        side: 'Buy',
        limitPrice: 50000,
        quantity: 0.5,
        minFill: 0.05,
        expiresAt: null,
      })
      .then((order) => {
        assert.ok(c.listMyOrders(LOCAL).some((o) => o.orderId === order.orderId))
        assert.ok(c.listBook('cBTC-USDCx').some((o) => o.orderId === order.orderId))
        const after = c.getBalances(LOCAL).find((b) => b.label === 'USDCx')?.declared ?? -1
        assert.equal(after, before + 25000)
      })
  })

  it('cancelOrder removes it and releases declared funding', async () => {
    const c = new MockDarkPoolClient(0)
    const order = await c.placeOrder(LOCAL, {
      poolId: 'cBTC-USDCx',
      side: 'Buy',
      limitPrice: 50000,
      quantity: 0.5,
      minFill: 0.05,
      expiresAt: null,
    })
    await c.cancelOrder(LOCAL, order.orderId)
    assert.equal(
      c.listMyOrders(LOCAL).some((o) => o.orderId === order.orderId),
      false,
    )
    assert.equal(c.getBalances(LOCAL).find((b) => b.label === 'USDCx')?.declared, 0)
  })

  it('matchOrders settles at the midpoint, records a trade, and re-rests a remainder', async () => {
    const c = new MockDarkPoolClient(0)
    const buy = await c.placeOrder(LOCAL, {
      poolId: 'cBTC-USDCx',
      side: 'Buy',
      limitPrice: 50000,
      quantity: 0.5,
      minFill: 0.05,
      expiresAt: null,
    })
    const result = await c.matchOrders(buy.orderId, 's1')
    assert.equal(result.execPrice, 49950)
    assert.equal(result.fillQty, 0.45)
    assert.ok(result.buyRemainder)
    assert.equal(c.listTrades('cBTC-USDCx')[0].quantity, 0.45)
    assert.ok(c.listMyFills(LOCAL).some((f) => f.quantity === 0.45 && f.side === 'Buy'))
  })

  it('matchOrders rejects non-crossing or same-side pairs', async () => {
    const c = new MockDarkPoolClient(0)
    const buyLow = await c.placeOrder(LOCAL, {
      poolId: 'cBTC-USDCx',
      side: 'Buy',
      limitPrice: 40000,
      quantity: 0.5,
      minFill: 0.05,
      expiresAt: null,
    })
    await assert.rejects(() => c.matchOrders(buyLow.orderId, 's1'))
  })

  it('returns a stable snapshot reference until a mutation, then a fresh one', async () => {
    const c = new MockDarkPoolClient(0)
    const a = c.listBook('cBTC-USDCx')
    const b = c.listBook('cBTC-USDCx')
    assert.equal(a, b)
    await c.placeOrder(LOCAL, {
      poolId: 'cBTC-USDCx',
      side: 'Buy',
      limitPrice: 50000,
      quantity: 0.5,
      minFill: 0.05,
      expiresAt: null,
    })
    const d = c.listBook('cBTC-USDCx')
    assert.notEqual(a, d)
  })

  it('notifies subscribers on mutation', async () => {
    const c = new MockDarkPoolClient(0)
    let calls = 0
    const unsub = c.subscribe(() => {
      calls += 1
    })
    await c.placeOrder(LOCAL, {
      poolId: 'cBTC-USDCx',
      side: 'Sell',
      limitPrice: 49000,
      quantity: 0.5,
      minFill: 0.05,
      expiresAt: null,
    })
    unsub()
    assert.ok(calls >= 1)
  })
})
