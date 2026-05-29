import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'
import type {
  RuntimePendingRequest,
  RuntimePendingRequestMessage,
  RuntimeProviderResponse,
} from '@/extension/messages.ts'
import {
  createRuntimeResponder,
  getDirectConnectedOrigins,
  getPendingProviderRequests,
  subscribeToDirectConnectedOrigins,
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
          callback(
            typeof message === 'object' &&
              message !== null &&
              (message as { type?: unknown }).type === 'CARPINCHO_GET_CONNECTED_ORIGINS'
              ? ['http://localhost:3012']
              : [pending],
          )
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
    // Scenario: the popup needs the queued direct-provider requests when it opens.
    const runtime = installChromeRuntime()

    // Ask the background worker for pending requests through chrome.runtime.sendMessage.
    const result = await getPendingProviderRequests()

    // The client should send the pending-request message and expose the queued request unchanged.
    assert.deepEqual(runtime.sent, [{ type: 'CARPINCHO_GET_PENDING_REQUESTS' }])
    assert.deepEqual(result, [pending])
  })

  it('loads direct connected origins from the background worker', async () => {
    // Scenario: the popup footer needs direct dApp connection state without WalletConnect sessions.
    const runtime = installChromeRuntime()

    // Ask the background worker for origins that completed a direct connect request.
    const result = await getDirectConnectedOrigins()

    // The client should send the connected-origins message and expose the recorded dApp origin.
    assert.deepEqual(runtime.sent, [{ type: 'CARPINCHO_GET_CONNECTED_ORIGINS' }])
    assert.deepEqual(result, ['http://localhost:3012'])
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
    // Scenario: while the popup is open, the background can push newly queued approval requests.
    const runtime = installChromeRuntime()
    const received: RuntimePendingRequest[] = []

    // Subscribe to runtime pending-request messages and then emit one fake request.
    const unsubscribe = subscribeToPendingProviderRequests((request) => {
      received.push(request)
    })

    runtime.emit({ type: 'CARPINCHO_PENDING_REQUEST', pending })
    unsubscribe()
    runtime.emit({
      type: 'CARPINCHO_PENDING_REQUEST',
      pending: { ...pending, requestId: 'after-unsubscribe' },
    })

    // Only the message sent before unsubscribe should reach the popup callback.
    assert.deepEqual(received, [pending])
  })

  it('subscribes to direct connected origin changes from session storage', () => {
    // Scenario: the popup footer tracks direct dApp connection state from session-storage writes.
    const listeners = new Set<(changes: Record<string, { newValue?: unknown }>) => void>()
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          session: {
            onChanged: {
              addListener: (
                listener: (changes: Record<string, { newValue?: unknown }>) => void,
              ) => {
                listeners.add(listener)
              },
              removeListener: (
                listener: (changes: Record<string, { newValue?: unknown }>) => void,
              ) => {
                listeners.delete(listener)
              },
            },
          },
        },
      },
    })
    const received: string[][] = []

    const unsubscribe = subscribeToDirectConnectedOrigins((origins) => {
      received.push(origins)
    })

    for (const listener of listeners) {
      listener({ 'carpincho.direct.connectedOrigins': { newValue: ['http://localhost:3012'] } })
    }
    unsubscribe()
    for (const listener of listeners) {
      listener({ 'carpincho.direct.connectedOrigins': { newValue: ['http://localhost:3013'] } })
    }

    // The footer receives the new origins until it unsubscribes.
    assert.deepEqual(received, [['http://localhost:3012']])
  })
})
