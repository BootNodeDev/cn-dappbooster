import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { WALLET_CONNECT_DB, wipeWalletConnectStorage } from '@/wc/storage'

const restoreIndexedDb = (): void => {
  // happy-dom does not provide indexedDB, so the registered default is undefined.
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
}

describe('wipeWalletConnectStorage', () => {
  afterEach(() => {
    restoreIndexedDb()
  })

  it('deletes the WalletConnect IndexedDB database', async () => {
    const deleted: string[] = []
    const request: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {}
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: (name: string) => {
          deleted.push(name)
          queueMicrotask(() => request.onsuccess?.())
          return request
        },
      },
    })

    await wipeWalletConnectStorage()

    assert.deepEqual(deleted, [WALLET_CONNECT_DB])
  })

  it('resolves when an open connection blocks the delete', async () => {
    const request: { onsuccess?: () => void; onerror?: () => void; onblocked?: () => void } = {}
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: () => {
          queueMicrotask(() => request.onblocked?.())
          return request
        },
      },
    })

    // Must not hang: a blocked delete completes once the post-reset reload closes the connection.
    await wipeWalletConnectStorage()
  })

  it('resolves without throwing when IndexedDB is unavailable', async () => {
    await wipeWalletConnectStorage()
  })
})
