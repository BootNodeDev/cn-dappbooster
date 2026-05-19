import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type {
  RuntimePendingRequest,
  RuntimePendingRequestMessage,
  RuntimeProviderResponse,
} from '@/extension/messages.ts'
import {
  createRuntimeResponder,
  getPendingProviderRequests,
  subscribeToPendingProviderRequests,
} from '@/extension/runtimeClient.ts'

const originalChrome = (globalThis as { chrome?: unknown }).chrome

const pending: RuntimePendingRequest = {
  requestId: 'rpc-1',
  origin: 'http://localhost:3012',
  createdAt: 1,
  request: {
    jsonrpc: '2.0',
    id: 'json-rpc-1',
    method: 'listAccounts',
  },
}

const installChromeRuntime = (): {
  sent: unknown[]
  emit: (message: RuntimePendingRequestMessage) => void
} => {
  const sent: unknown[] = []
  const listeners = new Set<(message: unknown) => void>()
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: {
        sendMessage: (message: unknown, callback: (response?: unknown) => void) => {
          sent.push(message)
          callback(Array.isArray(message) ? [] : [pending])
        },
        onMessage: {
          addListener: (listener: (message: unknown) => void) => {
            listeners.add(listener)
          },
          removeListener: (listener: (message: unknown) => void) => {
            listeners.delete(listener)
          },
        },
      },
    },
  })
  return {
    sent,
    emit: (message) => {
      for (const listener of listeners) {
        listener(message)
      }
    },
  }
}

afterEach(() => {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: originalChrome,
  })
})

describe('extension runtime client', () => {
  it('loads pending provider requests from the background worker', async () => {
    const runtime = installChromeRuntime()

    const result = await getPendingProviderRequests()

    assert.deepEqual(runtime.sent, [{ type: 'CARPINCHO_GET_PENDING_REQUESTS' }])
    assert.deepEqual(result, [pending])
  })

  it('converts provider responses into runtime messages', async () => {
    const runtime = installChromeRuntime()
    const responder = createRuntimeResponder(pending)

    await responder.result({ ok: true })
    await responder.error(4001, 'user rejected')

    assert.deepEqual((runtime.sent[0] as RuntimeProviderResponse).response, {
      jsonrpc: '2.0',
      id: 'json-rpc-1',
      result: { ok: true },
    })
    assert.deepEqual((runtime.sent[1] as RuntimeProviderResponse).response, {
      jsonrpc: '2.0',
      id: 'json-rpc-1',
      error: { code: 4001, message: 'user rejected' },
    })
  })

  it('subscribes to newly queued provider requests', () => {
    const runtime = installChromeRuntime()
    const received: RuntimePendingRequest[] = []
    const unsubscribe = subscribeToPendingProviderRequests((request) => {
      received.push(request)
    })

    runtime.emit({ type: 'CARPINCHO_PENDING_REQUEST', pending })
    unsubscribe()
    runtime.emit({
      type: 'CARPINCHO_PENDING_REQUEST',
      pending: { ...pending, requestId: 'after-unsubscribe' },
    })

    assert.deepEqual(received, [pending])
  })
})
