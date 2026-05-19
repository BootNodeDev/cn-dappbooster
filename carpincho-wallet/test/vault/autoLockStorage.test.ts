import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadAutoLockOption, writeAutoLockOption } from '@/vault/storage.ts'

describe('auto-lock option storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('returns "never" when nothing is persisted', () => {
    assert.equal(loadAutoLockOption(), 'never')
  })

  it('round-trips through localStorage', () => {
    writeAutoLockOption('5m')
    assert.equal(loadAutoLockOption(), '5m')
  })

  it('falls back to "never" when persisted value is unrecognised', () => {
    localStorage.setItem('carpincho.autoLockOption', 'bogus')
    assert.equal(loadAutoLockOption(), 'never')
  })

  it('accepts every supported option', () => {
    for (const opt of ['never', '1m', '5m', '1h'] as const) {
      writeAutoLockOption(opt)
      assert.equal(loadAutoLockOption(), opt)
    }
  })
})
