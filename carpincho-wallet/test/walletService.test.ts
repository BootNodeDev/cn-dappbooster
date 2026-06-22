import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { WalletServiceRpcError } from '@/api/walletService'

describe('WalletServiceRpcError', () => {
  it('keeps a string message as-is', () => {
    const error = new WalletServiceRpcError({ code: -32000, message: 'boom' })
    assert.equal(error.message, 'boom')
    assert.equal(error.code, -32000)
  })

  it('serializes a non-string message instead of coercing to [object Object]', () => {
    const error = new WalletServiceRpcError({
      code: -32000,
      message: { code: 'LEDGER_API_INTERNAL_ERROR', cause: 'Expected ujson.Arr' } as never,
    })
    assert.equal(error.message, '{"code":"LEDGER_API_INTERNAL_ERROR","cause":"Expected ujson.Arr"}')
  })

  it('falls back to a code-tagged message when message is undefined', () => {
    const error = new WalletServiceRpcError({ code: -32000, message: undefined as never })
    assert.equal(error.message, 'wallet gateway error -32000')
  })

  it('preserves code and data', () => {
    const data = { context: 'prepare' }
    const error = new WalletServiceRpcError({ code: -32099, message: 'x', data })
    assert.equal(error.code, -32099)
    assert.deepEqual(error.data, data)
  })
})
