import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { buildStatus } from '@/provider/status'

const rootVersion = (
  JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

describe('runtime provider version', () => {
  it('reports the full root package.json version via __APP_VERSION__', async (t) => {
    // Force the wallet-service request to fail so buildStatus takes its offline
    // branch without a real network call; the version is identical in both
    // branches. This closes the loop on the __APP_VERSION__ build-time define.
    t.mock.method(globalThis, 'fetch', () => Promise.reject(new Error('offline')))

    const status = await buildStatus()

    assert.equal(status.provider.version, rootVersion)
  })
})
