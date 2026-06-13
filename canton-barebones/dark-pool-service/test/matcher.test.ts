import assert from 'node:assert/strict'
import { test } from 'node:test'
import { findMatches } from '../src/matcher.ts'
import type { OrderContract, Side } from '../src/types.ts'

const POOL = { poolId: 'TTA-TTB', minFillFloor: '1.0' }
const instr = { admin: 'admin', id: 'X' }

interface OrderSpec {
  id: string
  off: number
  t: string
  side: Side
  q: string
  p: string
  mf?: string
  exp?: number | null
}

const ord = (o: OrderSpec): OrderContract => ({
  contractId: o.id,
  createdOffset: o.off,
  trader: o.t,
  venue: 'venue',
  poolId: 'TTA-TTB',
  base: instr,
  quote: instr,
  side: o.side,
  quantity: o.q,
  limitPrice: o.p,
  minFill: o.mf ?? '1.0',
  expiresAt: o.exp ?? null,
  holdingCids: [],
})

test('matches a crossing buy/sell, fillQty = min', () => {
  const buy = ord({ id: 'b', off: 1, t: 'alice', side: 'Buy', q: '10.0', p: '2.0' })
  const sell = ord({ id: 's', off: 2, t: 'bob', side: 'Sell', q: '8.0', p: '1.0' })
  const plans = findMatches(POOL, [buy, sell], 0)
  assert.equal(plans.length, 1)
  assert.deepEqual(
    { b: plans[0].buyOrderCid, s: plans[0].sellOrderCid, q: plans[0].fillQty },
    { b: 'b', s: 's', q: '8.0000000000' },
  )
})

test('no match when limits do not cross', () => {
  const buy = ord({ id: 'b', off: 1, t: 'alice', side: 'Buy', q: '10.0', p: '0.9' })
  const sell = ord({ id: 's', off: 2, t: 'bob', side: 'Sell', q: '10.0', p: '1.0' })
  assert.equal(findMatches(POOL, [buy, sell], 0).length, 0)
})

test('no self-match', () => {
  const buy = ord({ id: 'b', off: 1, t: 'alice', side: 'Buy', q: '10.0', p: '2.0' })
  const sell = ord({ id: 's', off: 2, t: 'alice', side: 'Sell', q: '10.0', p: '1.0' })
  assert.equal(findMatches(POOL, [buy, sell], 0).length, 0)
})

test('skips when fillQty < a minFill', () => {
  const buy = ord({ id: 'b', off: 1, t: 'alice', side: 'Buy', q: '10.0', p: '2.0', mf: '1.0' })
  const sell = ord({ id: 's', off: 2, t: 'bob', side: 'Sell', q: '0.5', p: '1.0', mf: '0.5' })
  assert.equal(findMatches(POOL, [buy, sell], 0).length, 0)
})

test('price-time priority: best price then oldest offset', () => {
  const b1 = ord({ id: 'b1', off: 5, t: 'alice', side: 'Buy', q: '5.0', p: '2.0' })
  const b2 = ord({ id: 'b2', off: 1, t: 'carol', side: 'Buy', q: '5.0', p: '2.0' })
  const sell = ord({ id: 's', off: 2, t: 'bob', side: 'Sell', q: '5.0', p: '1.0' })
  const plans = findMatches(POOL, [b1, b2, sell], 0)
  assert.equal(plans[0].buyOrderCid, 'b2')
})

test('excludes expired orders', () => {
  const buy = ord({ id: 'b', off: 1, t: 'alice', side: 'Buy', q: '10.0', p: '2.0', exp: 100 })
  const sell = ord({ id: 's', off: 2, t: 'bob', side: 'Sell', q: '10.0', p: '1.0' })
  assert.equal(findMatches(POOL, [buy, sell], 200).length, 0)
})

test('one sell is consumed by only one buy per pass', () => {
  const b1 = ord({ id: 'b1', off: 1, t: 'alice', side: 'Buy', q: '5.0', p: '2.0' })
  const b2 = ord({ id: 'b2', off: 2, t: 'carol', side: 'Buy', q: '5.0', p: '2.0' })
  const sell = ord({ id: 's', off: 3, t: 'bob', side: 'Sell', q: '5.0', p: '1.0' })
  const plans = findMatches(POOL, [b1, b2, sell], 0)
  assert.equal(plans.length, 1)
})
