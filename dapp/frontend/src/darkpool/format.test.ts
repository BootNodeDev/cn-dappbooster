import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatNotional, formatPrice, formatQty } from './format.ts'

describe('format', () => {
  it('formatPrice groups thousands with 2 dp', () => {
    assert.equal(formatPrice(49750), '49,750.00')
    assert.equal(formatPrice(49750.5), '49,750.50')
    assert.equal(formatPrice(1000000), '1,000,000.00')
  })
  it('formatPrice truncates extra decimals, never rounds up', () => {
    assert.equal(formatPrice(1000.9893912312), '1,000.98')
    assert.equal(formatPrice(0.999), '0.99')
  })
  it('formatQty uses 4 dp with grouping', () => {
    assert.equal(formatQty(0.5), '0.5000')
    assert.equal(formatQty(0.45), '0.4500')
    assert.equal(formatQty(1234.5), '1,234.5000')
  })
  it('formatNotional groups thousands with 2 dp, truncated', () => {
    assert.equal(formatNotional(25000), '25,000.00')
    assert.equal(formatNotional(22477.559), '22,477.55')
  })
})
