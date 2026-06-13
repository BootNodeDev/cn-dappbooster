import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buyFundingTarget,
  crosses,
  fillQuantity,
  floorTo10,
  midpointPrice,
  priceWithinLimit,
  quoteAmount,
  remainderQuantity,
} from './darkpoolMath.ts'

describe('darkpoolMath', () => {
  it('floorTo10 truncates to 10 dp, never rounds up', () => {
    assert.equal(floorTo10(1.99999999999), 1.9999999999)
    assert.equal(floorTo10(2.5), 2.5)
  })
  it('midpointPrice averages and floors', () => {
    assert.equal(midpointPrice(2.0, 1.0), 1.5)
    assert.equal(midpointPrice(50000, 49000), 49500)
  })
  it('crosses when buy limit >= sell limit', () => {
    assert.equal(crosses(50000, 49000), true)
    assert.equal(crosses(49000, 50000), false)
    assert.equal(crosses(50000, 50000), true)
  })
  it('fillQuantity is the min of the two sizes', () => {
    assert.equal(fillQuantity(10, 4), 4)
    assert.equal(fillQuantity(0.45, 0.5), 0.45)
  })
  it('remainderQuantity returns leftover only when >= minFill', () => {
    assert.equal(remainderQuantity(10, 4, 2), 6)
    assert.equal(remainderQuantity(4, 4, 1), null)
    assert.equal(remainderQuantity(0.5, 0.45, 0.1), null) // 0.05 < 0.1
  })
  it('quoteAmount multiplies and floors to 10 dp', () => {
    assert.equal(quoteAmount(10, 1.5), 15)
    assert.equal(quoteAmount(0.45, 49500), 22275)
  })
  it('buyFundingTarget equals quoteAmount at the limit', () => {
    assert.equal(buyFundingTarget(0.5, 50000), 25000)
  })
  it('priceWithinLimit guards buyer and seller direction', () => {
    assert.equal(priceWithinLimit('Buy', 49500, 50000), true)
    assert.equal(priceWithinLimit('Buy', 50001, 50000), false)
    assert.equal(priceWithinLimit('Sell', 49500, 49000), true)
    assert.equal(priceWithinLimit('Sell', 48999, 49000), false)
  })
})
