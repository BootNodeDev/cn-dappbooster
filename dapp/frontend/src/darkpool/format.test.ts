import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatNotional, formatPrice, formatQty } from './format.ts'

describe('format', () => {
  it('formatPrice groups thousands with 2 dp', () => {
    assert.equal(formatPrice(49750), '49,750.00')
    assert.equal(formatPrice(49750.5), '49,750.50')
  })
  it('formatQty uses 4 dp', () => {
    assert.equal(formatQty(0.5), '0.5000')
  })
  it('formatNotional groups thousands with 2 dp', () => {
    assert.equal(formatNotional(25000), '25,000.00')
  })
})
