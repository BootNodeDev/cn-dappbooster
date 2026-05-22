import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { loadConfig } from '../src/config.ts'

describe('config loader', () => {
  it('returns defaults when no env vars are set', () => {
    const config = loadConfig()
    assert.equal(config.port, 3010)
    assert.deepEqual(config.corsOrigins, ['http://localhost:3011'])
    assert.equal(config.network, 'canton:local')
    assert.equal(config.provider.id, 'counter-wallet-service')
  })
})
