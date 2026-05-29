import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.ts'

const CANTON_VARS = [
  'CANTON_BACKEND_TOKEN',
  'CANTON_AUTH_AUDIENCE',
  'CANTON_AUTH_SECRET',
  'CANTON_ADMIN_USER_ID',
  'WALLET_SERVICE_MOCK',
] as const

const snapshot = (): Record<string, string | undefined> =>
  Object.fromEntries(CANTON_VARS.map((name) => [name, process.env[name]]))

const restore = (saved: Record<string, string | undefined>): void => {
  for (const [name, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }
}

describe('config loader', () => {
  let saved: Record<string, string | undefined>

  beforeEach(() => {
    saved = snapshot()
    for (const name of CANTON_VARS) {
      delete process.env[name]
    }
  })

  afterEach(() => {
    restore(saved)
  })

  it('returns defaults when no env vars are set', () => {
    const config = loadConfig()
    assert.equal(config.port, 3010)
    assert.deepEqual(config.corsOrigins, ['http://localhost:3011'])
    assert.equal(config.network, 'canton:local')
    assert.equal(config.provider.id, 'wallet-service')
  })

  it('tokenSource is "none" when nothing is configured (non-mock)', () => {
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'none')
    assert.equal(config.canton.backendToken, undefined)
  })

  it('tokenSource is "env" when CANTON_BACKEND_TOKEN is set', () => {
    process.env.CANTON_BACKEND_TOKEN = 'explicit.jwt.value'
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton-barebones.local'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'env')
    assert.equal(config.canton.backendToken, 'explicit.jwt.value')
  })

  it('tokenSource is "mint" when audience + secret are set but no explicit token', () => {
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton-barebones.local'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'mint')
    assert.equal(
      config.canton.backendToken,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ3YWxsZXQtc2VydmljZSIsImF1ZCI6Imh0dHBzOi8vY2FudG9uLWJhcmVib25lcy5sb2NhbCJ9.-3Xq4rrhJliXWkrqPNXid5_YuuTk3E6EDtQYux-ULiI',
    )
  })

  it('honours CANTON_ADMIN_USER_ID as the JWT subject when minting', () => {
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton-barebones.local'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    process.env.CANTON_ADMIN_USER_ID = 'custom-subject'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'mint')
    const seg = (config.canton.backendToken ?? '').split('.')[1]
    const payload = JSON.parse(
      Buffer.from(
        `${seg}${'='.repeat((4 - (seg.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    )
    assert.equal(payload.sub, 'custom-subject')
  })

  it('mock mode skips minting and leaves backendToken undefined', () => {
    process.env.WALLET_SERVICE_MOCK = '1'
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton-barebones.local'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'none')
    assert.equal(config.canton.backendToken, undefined)
  })
})
