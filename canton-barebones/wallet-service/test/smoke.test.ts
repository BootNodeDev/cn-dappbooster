import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.ts'

const CANTON_VARS = [
  'CANTON_BACKEND_TOKEN',
  'CANTON_AUTH_AUDIENCE',
  'CANTON_AUTH_SECRET',
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

  it('fails clearly when real mode starts without CANTON_BACKEND_TOKEN', () => {
    // Scenario: real wallet-service mode must not mint a bearer token from the
    // local auth recipe. The operator should generate a token explicitly and
    // paste it into CANTON_BACKEND_TOKEN so every runtime token is visible.
    assert.throws(
      () => loadConfig(),
      /CANTON_BACKEND_TOKEN is required\. Generate one with: npm run canton:token -- ledger-api-user/,
    )
  })

  it('does not use the local signing recipe to mint a wallet-service token', () => {
    // Scenario: the local signing recipe is only for scripts.
    // The runtime service must still fail until CANTON_BACKEND_TOKEN is set.
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.CANTON_AUTH_SECRET = 'unsafe'

    assert.throws(
      () => loadConfig(),
      /CANTON_BACKEND_TOKEN is required\. Generate one with: npm run canton:token -- ledger-api-user/,
    )
  })

  it('tokenSource is "env" when CANTON_BACKEND_TOKEN is set', () => {
    // Scenario: the explicit backend token is the only accepted real-mode
    // credential source, and it is passed through unchanged to SDK calls.
    process.env.CANTON_BACKEND_TOKEN = 'explicit.jwt.value'
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'env')
    assert.equal(config.canton.backendToken, 'explicit.jwt.value')
  })

  it('mock mode skips minting and leaves backendToken undefined', () => {
    // Scenario: mock mode is used for wallet-only UI iteration and must not
    // require any LocalNet token because all Canton calls are short-circuited.
    process.env.WALLET_SERVICE_MOCK = '1'
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'none')
    assert.equal(config.canton.backendToken, undefined)
  })
})
