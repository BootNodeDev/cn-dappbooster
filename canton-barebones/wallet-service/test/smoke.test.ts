import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.ts'

const CANTON_VARS = [
  'CANTON_AUTH_AUDIENCE',
  'CANTON_AUTH_SECRET',
  'FIVENORTH_AUTH_URL',
  'FIVENORTH_CLIENT_ID',
  'FIVENORTH_CLIENT_SECRET',
  'FIVENORTH_SCOPE',
  'SPLICE_VALIDATOR_URL',
  'SPLICE_REGISTRY_API_URL',
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

  it('fails clearly when real mode starts without the FiveNorth client secret', () => {
    // Scenario: FiveNorth mode refreshes OAuth tokens at runtime. A missing
    // machine-to-machine secret would make every Canton call fail later, so boot
    // should stop with the exact env var the operator must set.
    assert.throws(
      () => loadConfig(),
      /FIVENORTH_CLIENT_SECRET is required for FiveNorth token refresh/,
    )
  })

  it('does not use the local signing recipe as runtime auth', () => {
    // Scenario: old LocalNet signing inputs are still script-only. Runtime auth
    // must come from FiveNorth client credentials so tokens can be refreshed.
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.CANTON_AUTH_SECRET = 'unsafe'

    assert.throws(
      () => loadConfig(),
      /FIVENORTH_CLIENT_SECRET is required for FiveNorth token refresh/,
    )
  })

  it('loads FiveNorth client credentials for runtime token refresh', () => {
    // Scenario: the operator stores only the long-lived OAuth client secret.
    // wallet-service derives short-lived bearer tokens from these settings.
    process.env.FIVENORTH_CLIENT_SECRET = 'client-secret'

    const config = loadConfig()

    assert.equal(config.canton.tokenSource, 'fivenorth')
    assert.deepEqual(config.canton.auth, {
      tokenUrl: 'https://auth.sandbox.fivenorth.io/application/o/token/',
      clientId: 'validator-devnet-m2m',
      clientSecret: 'client-secret',
      scope: 'daml_ledger_api',
      refreshSkewMs: 60_000,
    })
  })

  it('defaults service URLs to the hosted FiveNorth validator', () => {
    // Scenario: this branch runs without the local Splice stack. Defaults should
    // point wallet-service at the hosted ledger API and validator scan-proxy.
    process.env.FIVENORTH_CLIENT_SECRET = 'client-secret'

    const config = loadConfig()

    assert.equal(
      config.canton.jsonApiUrl,
      'https://ledger-api.validator.devnet.sandbox.fivenorth.io',
    )
    assert.deepEqual(config.splice, {
      validatorUrl: 'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator',
      registryApiUrl:
        'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator/v0/scan-proxy',
    })
  })

  it('allows FiveNorth endpoints to be overridden by environment', () => {
    // Scenario: sandbox hostnames can change. Operators should be able to point
    // wallet-service at a different validator without code changes.
    process.env.FIVENORTH_CLIENT_SECRET = 'client-secret'
    process.env.FIVENORTH_AUTH_URL = 'https://auth.example/token'
    process.env.FIVENORTH_CLIENT_ID = 'client-id'
    process.env.FIVENORTH_SCOPE = 'custom_scope'
    process.env.SPLICE_VALIDATOR_URL = 'http://validator.example/api/validator'
    process.env.SPLICE_REGISTRY_API_URL = 'http://registry.example/api/registry'

    const config = loadConfig()

    assert.deepEqual(config.canton.auth, {
      tokenUrl: 'https://auth.example/token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      scope: 'custom_scope',
      refreshSkewMs: 60_000,
    })
    assert.deepEqual(config.splice, {
      validatorUrl: 'http://validator.example/api/validator',
      registryApiUrl: 'http://registry.example/api/registry',
    })
  })

  it('mock mode skips runtime auth', () => {
    // Scenario: mock mode is used for wallet-only UI iteration and must not
    // require FiveNorth credentials because all Canton calls are short-circuited.
    process.env.WALLET_SERVICE_MOCK = '1'
    process.env.CANTON_AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    const config = loadConfig()
    assert.equal(config.canton.tokenSource, 'none')
    assert.equal(config.canton.auth, undefined)
  })
})
