import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import {
  clearDirectConnectedOrigins,
  DIRECT_CONNECTED_ORIGINS_KEY,
  readDirectConnectedOrigins,
} from '@/extension/directConnections'

const originalChrome = (globalThis as { chrome?: unknown }).chrome

const installChromeSession = (
  initial: Record<string, unknown>,
): { store: Record<string, unknown>; removed: string[] } => {
  const store: Record<string, unknown> = { ...initial }
  const removed: string[] = []
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      storage: {
        session: {
          get: async (key: string) => ({ [key]: store[key] }),
          set: async (items: Record<string, unknown>) => {
            Object.assign(store, items)
          },
          remove: async (key: string) => {
            removed.push(key)
            delete store[key]
          },
        },
      },
    },
  })
  return { store, removed }
}

describe('clearDirectConnectedOrigins', () => {
  afterEach(() => {
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: originalChrome })
  })

  it('removes the connected-origins key from chrome session storage', async () => {
    const { store, removed } = installChromeSession({
      [DIRECT_CONNECTED_ORIGINS_KEY]: ['http://localhost:3012'],
    })

    await clearDirectConnectedOrigins()

    assert.deepEqual(removed, [DIRECT_CONNECTED_ORIGINS_KEY])
    assert.equal(store[DIRECT_CONNECTED_ORIGINS_KEY], undefined)
    assert.deepEqual(await readDirectConnectedOrigins(), [])
  })

  it('resolves without error when chrome session storage is unavailable', async () => {
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: undefined })
    await clearDirectConnectedOrigins()
  })
})
