import { afterEach, describe, expect, it, vi } from 'vitest'
import { uuid } from './uuid'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('uuid', () => {
  it('uses crypto.randomUUID when available', () => {
    expect(uuid()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  })

  it('returns distinct values across calls', () => {
    expect(uuid()).not.toBe(uuid())
  })

  it('falls back to getRandomValues in a non-secure context (no randomUUID)', () => {
    const bytes = (arr: Uint8Array): Uint8Array => {
      for (let i = 0; i < arr.length; i++) arr[i] = i
      return arr
    }
    vi.stubGlobal('crypto', { getRandomValues: bytes })
    const id = uuid()
    // v4-shaped: version nibble 4, variant nibble 8/9/a/b
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
  })

  it('falls back to a non-empty id when no crypto is present at all', () => {
    vi.stubGlobal('crypto', undefined)
    expect(uuid().length).toBeGreaterThan(0)
  })
})
