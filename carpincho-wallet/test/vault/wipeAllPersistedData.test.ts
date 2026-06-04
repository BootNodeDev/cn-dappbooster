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
})
