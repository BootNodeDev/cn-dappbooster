import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { subscribeToasts, type ToastEntry, toast } from './toast.ts'

describe('toast store cap', () => {
  it('keeps a persistent error when transient toasts overflow the cap', () => {
    let entries: ReadonlyArray<ToastEntry> = []
    const unsub = subscribeToasts((next) => {
      entries = next
    })
    const errorId = toast.error('boom')
    for (const message of ['a', 'b', 'c', 'd']) {
      toast.success(message)
    }
    assert.ok(
      entries.some((entry) => entry.id === errorId),
      'persistent error must survive a burst of transient toasts',
    )
    assert.equal(entries.filter((entry) => entry.variant === 'success').length, 3)
    for (const entry of entries) {
      toast.dismiss(entry.id)
    }
    unsub()
  })
})
