import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { wipeAllPersistedData } from '@/vault/storage'

describe('wipeAllPersistedData', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('removes every carpincho-namespaced key (vault and all preferences)', () => {
    localStorage.setItem('carpincho.vault', 'blob')
    localStorage.setItem('carpincho.vault.next', 'blob')
    localStorage.setItem('carpincho.autoLockOption', '5m')
    localStorage.setItem('carpincho-theme', 'dark')
    localStorage.setItem('carpincho.runtime-config.v1', '{}')

    wipeAllPersistedData()

    assert.equal(localStorage.length, 0)
  })

  it('leaves keys owned by other apps untouched', () => {
    localStorage.setItem('carpincho-theme', 'dark')
    localStorage.setItem('other-app.token', 'keep-me')

    wipeAllPersistedData()

    assert.equal(localStorage.getItem('carpincho-theme'), null)
    assert.equal(localStorage.getItem('other-app.token'), 'keep-me')
  })

  it('is a no-op when nothing is persisted', () => {
    wipeAllPersistedData()
    assert.equal(localStorage.length, 0)
  })

  it('keeps wiping the remaining keys when one removal throws', () => {
    // happy-dom's Storage ignores method monkeypatching, so swap the whole global for a
    // fake whose removeItem throws on one key to prove the wipe does not abort midway.
    const map = new Map<string, string>([
      ['carpincho.vault', 'blob'],
      ['carpincho.autoLockOption', '5m'],
    ])
    const fake = {
      get length(): number {
        return map.size
      },
      key: (index: number): string | null => [...map.keys()][index] ?? null,
      getItem: (key: string): string | null => map.get(key) ?? null,
      setItem: (key: string, value: string): void => {
        map.set(key, value)
      },
      removeItem: (key: string): void => {
        if (key === 'carpincho.vault') {
          throw new Error('storage disabled')
        }
        map.delete(key)
      },
    }
    const real = globalThis.localStorage
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: fake })

    try {
      wipeAllPersistedData()
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: real })
    }

    assert.equal(map.get('carpincho.autoLockOption'), undefined)
  })
})
