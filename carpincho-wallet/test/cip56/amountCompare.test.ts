import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { compareDecimalStrings } from '@/cip56/amount'

describe('compareDecimalStrings', () => {
  it('compares decimals of differing scale without float error', () => {
    assert.equal(compareDecimalStrings('10', '9.999999999'), 1)
    assert.equal(compareDecimalStrings('1.5', '1.50'), 0)
    assert.equal(compareDecimalStrings('0.1', '0.2'), -1)
    assert.equal(compareDecimalStrings('1000.00', '1000'), 0)
  })

  it('returns undefined for non-decimal input', () => {
    assert.equal(compareDecimalStrings('abc', '1'), undefined)
    assert.equal(compareDecimalStrings('1', ''), undefined)
  })
})
