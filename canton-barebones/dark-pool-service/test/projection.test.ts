import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bookFor, myOrders, toBalances } from '../src/projection.ts'
import type { Holding, InstrumentId, OrderContract, Side } from '../src/types.ts'

const TTA: InstrumentId = { admin: 'admin', id: 'TTA' }
const TTB: InstrumentId = { admin: 'admin', id: 'TTB' }

const hold = (
  contractId: string,
  owner: string,
  instrument: InstrumentId,
  amount: string,
): Holding => ({
  contractId,
  owner,
  instrument,
  amount,
})

const order = (
  contractId: string,
  trader: string,
  side: Side,
  holdingCids: string[],
): OrderContract => ({
  contractId,
  createdOffset: 1,
  trader,
  venue: 'venue',
  poolId: 'TTA-TTB',
  base: TTA,
  quote: TTB,
  side,
  quantity: '10.0',
  limitPrice: '2.0',
  minFill: '1.0',
  expiresAt: null,
  holdingCids,
})

test('toBalances: total per instrument sums the party holdings', () => {
  const holdings = [
    hold('h1', 'alice', TTA, '100.0'),
    hold('h2', 'alice', TTA, '50.0'),
    hold('h3', 'bob', TTA, '7.0'),
  ]
  const balances = toBalances(holdings, [], 'alice', [TTA, TTB])
  assert.equal(balances[0].total, '150.0000000000')
  assert.equal(balances[1].total, '0.0000000000')
})

test('toBalances: declared sums only amounts referenced by the party open orders', () => {
  const holdings = [hold('h1', 'alice', TTB, '40.0'), hold('h2', 'alice', TTB, '60.0')]
  const orders = [order('o1', 'alice', 'Buy', ['h1'])]
  const balances = toBalances(holdings, orders, 'alice', [TTB])
  assert.equal(balances[0].total, '100.0000000000')
  assert.equal(balances[0].declared, '40.0000000000')
})

test('toBalances: ignores other parties holdings and orders', () => {
  const holdings = [hold('h1', 'alice', TTA, '10.0'), hold('h2', 'bob', TTA, '99.0')]
  const orders = [order('o1', 'bob', 'Sell', ['h2'])]
  const balances = toBalances(holdings, orders, 'alice', [TTA])
  assert.equal(balances[0].total, '10.0000000000')
  assert.equal(balances[0].declared, '0.0000000000')
})

test('bookFor returns every resting order in the pool', () => {
  const orders = [order('o1', 'alice', 'Buy', []), order('o2', 'bob', 'Sell', [])]
  assert.equal(bookFor(orders, 'TTA-TTB').length, 2)
  assert.equal(bookFor(orders, 'OTHER').length, 0)
})

test('myOrders returns only the party own orders', () => {
  const orders = [order('o1', 'alice', 'Buy', []), order('o2', 'bob', 'Sell', [])]
  const mine = myOrders(orders, 'alice')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].contractId, 'o1')
})
