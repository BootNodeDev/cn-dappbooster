import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { act, cleanup, renderHook } from '@testing-library/react'
import { useWalletServiceTest } from '@/hooks/useWalletServiceTest'

const originalFetch = globalThis.fetch

const respond = (result: unknown): void => {
  globalThis.fetch = async () => new Response(JSON.stringify({ result }), { status: 200 })
}

describe('useWalletServiceTest', () => {
  afterEach(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  it('maps a connected status to connected with the network id', async () => {
    respond({ connection: { isNetworkConnected: true }, network: { networkId: 'canton:local' } })
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'connected')
    assert.equal(result.current.networkId, 'canton:local')
    assert.equal(result.current.testedUrl, 'http://host/rpc')
  })

  it('maps a responded-but-not-connected status to unreachable with the reason', async () => {
    respond({ connection: { isNetworkConnected: false, networkReason: 'syncing' } })
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'unreachable')
    assert.equal(result.current.reason, 'syncing')
  })

  it('maps a thrown request to unreachable with the error message', async () => {
    globalThis.fetch = async () => {
      throw new Error('Failed to fetch')
    }
    const { result } = renderHook(() => useWalletServiceTest())
    await act(async () => {
      await result.current.test('http://host/rpc')
    })
    assert.equal(result.current.state, 'unreachable')
    assert.equal(result.current.reason, 'Failed to fetch')
  })
})
