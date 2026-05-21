import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createPendingStore } from '../src/rpc.ts'

describe('pendingStore', () => {
  it('returns entries set within the TTL window', () => {
    const store = createPendingStore<string>({ ttlMs: 60_000, maxSize: 8 })
    store.set('a', 'value-a')
    assert.equal(store.get('a'), 'value-a')
  })

  it('evicts entries older than the TTL', () => {
    let now = 1000
    const store = createPendingStore<string>({ ttlMs: 100, maxSize: 8, now: () => now })
    store.set('a', 'value-a')
    now = 1200
    assert.equal(store.get('a'), undefined)
  })

  it('evicts oldest entries when size exceeds maxSize', () => {
    const store = createPendingStore<string>({ ttlMs: 60_000, maxSize: 2 })
    store.set('a', 'value-a')
    store.set('b', 'value-b')
    store.set('c', 'value-c')
    assert.equal(store.get('a'), undefined)
    assert.equal(store.get('b'), 'value-b')
    assert.equal(store.get('c'), 'value-c')
  })

  it('delete removes the entry', () => {
    const store = createPendingStore<string>({ ttlMs: 60_000, maxSize: 8 })
    store.set('a', 'value-a')
    store.delete('a')
    assert.equal(store.get('a'), undefined)
  })
})
