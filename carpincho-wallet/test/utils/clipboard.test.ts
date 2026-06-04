import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { copyPartyId } from '@/utils/clipboard'

const originalClipboard = globalThis.navigator?.clipboard

describe('copyPartyId', () => {
  afterEach(() => {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
    })
  })

  it('writes the party id to the clipboard', async () => {
    const written: string[] = []
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      value: { writeText: async (v: string) => void written.push(v) },
      configurable: true,
    })

    copyPartyId('party-abc')
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(written, ['party-abc'])
  })
})
