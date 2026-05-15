import assert from 'node:assert/strict'
import { afterEach, describe, it } from 'node:test'

import {
  clearSessionPassword,
  persistSessionPassword,
  readSessionPassword,
  shouldWipeMemoryOnPageHide
} from '../src/vault/sessionUnlock.ts'

type FakeChromeStorage = {
  data: Record<string, string>
  api: {
    storage: {
      session: {
        set: (items: Record<string, string>) => Promise<void>
        get: (key: string) => Promise<Record<string, string | undefined>>
        remove: (key: string) => Promise<void>
      }
    }
  }
}

const originalChrome = (globalThis as { chrome?: unknown }).chrome
const originalWindow = globalThis.window
const originalSessionStorage = globalThis.sessionStorage

const installWindow = (protocol: string, sessionStorage: Storage = memoryStorage()): void => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { protocol } }
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: sessionStorage
  })
}

const installChromeStorage = (): FakeChromeStorage => {
  const fake: FakeChromeStorage = {
    data: {},
    api: {
      storage: {
        session: {
          set: async (items) => {
            Object.assign(fake.data, items)
          },
          get: async (key) => ({ [key]: fake.data[key] }),
          remove: async (key) => {
            delete fake.data[key]
          }
        }
      }
    }
  }
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: fake.api
  })
  return fake
}

const memoryStorage = (): Storage => {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => Array.from(data.keys())[index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, value)
    }
  }
}

afterEach(() => {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: originalChrome
  })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: originalWindow
  })
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: originalSessionStorage
  })
})

describe('session unlock persistence', () => {
  it('keeps extension unlock material in chrome session storage', async () => {
    installWindow('chrome-extension:')
    const chromeStorage = installChromeStorage()

    await persistSessionPassword('secret')

    assert.equal(chromeStorage.data['carpincho.session.unlock'], 'secret')
    assert.equal(await readSessionPassword(), 'secret')
    await clearSessionPassword()
    assert.equal(chromeStorage.data['carpincho.session.unlock'], undefined)
  })

  it('does not wipe unlock material when an extension popup closes', () => {
    installWindow('chrome-extension:')

    assert.equal(shouldWipeMemoryOnPageHide(), false)
  })

  it('keeps web refresh behavior on sessionStorage', async () => {
    const storage = memoryStorage()
    installWindow('http:', storage)

    await persistSessionPassword('web-secret')

    assert.equal(storage.getItem('carpincho.session.unlock'), 'web-secret')
    assert.equal(await readSessionPassword(), 'web-secret')
    assert.equal(shouldWipeMemoryOnPageHide(), true)
    await clearSessionPassword()
    assert.equal(storage.getItem('carpincho.session.unlock'), null)
  })
})
