import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { DIRECT_CONNECTED_ORIGINS_KEY } from '@/extension/directConnections'
import { useVault } from '@/vault/useVault'
import { type VaultContextValue, VaultProvider } from '@/vault/VaultContext'
import { WALLET_CONNECT_DB } from '@/wc/storage'

const originalChrome = (globalThis as { chrome?: unknown }).chrome

const captureVault = (): { ref: { current: VaultContextValue | null } } => {
  const ref: { current: VaultContextValue | null } = { current: null }
  const Probe = (): null => {
    ref.current = useVault()
    return null
  }
  render(
    <VaultProvider>
      <Probe />
    </VaultProvider>,
  )
  return { ref }
}

describe('VaultContext.destroyVault full wipe', () => {
  let reloads = 0
  let deletedDbs: string[]
  let sessionStore: Record<string, unknown>
  let realReload: typeof window.location.reload

  beforeEach(() => {
    localStorage.clear()
    reloads = 0
    deletedDbs = []
    sessionStore = { [DIRECT_CONNECTED_ORIGINS_KEY]: ['http://localhost:3012'] }

    realReload = window.location.reload
    Object.defineProperty(window.location, 'reload', {
      configurable: true,
      value: () => {
        reloads += 1
      },
    })

    const request: { onsuccess?: () => void } = {}
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        deleteDatabase: (name: string) => {
          deletedDbs.push(name)
          queueMicrotask(() => request.onsuccess?.())
          return request
        },
      },
    })

    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: {
        storage: {
          session: {
            get: async (key: string) => ({ [key]: sessionStore[key] }),
            set: async (items: Record<string, unknown>) => {
              Object.assign(sessionStore, items)
            },
            remove: async (key: string) => {
              delete sessionStore[key]
            },
          },
        },
      },
    })
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
    Object.defineProperty(window.location, 'reload', { configurable: true, value: realReload })
    Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined })
    Object.defineProperty(globalThis, 'chrome', { configurable: true, value: originalChrome })
  })

  it('wipes localStorage, WalletConnect IndexedDB, direct origins, and resets state', async () => {
    localStorage.setItem('other-app.token', 'keep-me')
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    assert.equal(ref.current?.hasVault, true)
    assert.notEqual(localStorage.getItem('carpincho.vault'), null)

    await act(async () => {
      await ref.current?.destroyVault()
    })

    // localStorage: every carpincho key gone, foreign key kept.
    assert.equal(localStorage.getItem('carpincho.vault'), null)
    assert.equal(localStorage.getItem('other-app.token'), 'keep-me')
    // WalletConnect IndexedDB dropped.
    assert.deepEqual(deletedDbs, [WALLET_CONNECT_DB])
    // Direct connected origins cleared from chrome session storage.
    assert.equal(sessionStore[DIRECT_CONNECTED_ORIGINS_KEY], undefined)
    // State reset stands even though reload is the primary mechanism.
    assert.equal(reloads, 1)
    assert.equal(ref.current?.hasVault, false)
    assert.equal(ref.current?.isLocked, true)
  })
})
