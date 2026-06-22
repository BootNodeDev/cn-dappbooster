import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.ts'

const CONFIG_VARS = [
  'PORT',
  'CORS_ORIGINS',
  'NETWORK',
  'PROVIDER_ID',
  'PROVIDER_VERSION',
  'PROVIDER_URL',
  'PROVIDER_USER_URL',
  'CANTON_JSON_API_URL',
  'CANTON_LEDGER_API_URL',
  'CANTON_ADMIN_API_URL',
  'SPLICE_VALIDATOR_URL',
  'SPLICE_SCAN_API_URL',
  'SPLICE_REGISTRY_API_URL',
  'AUTH_MODE',
  'AUTH_AUDIENCE',
  'AUTH_SUBJECT',
  'AUTH_SECRET',
  'AUTH_TOKEN',
  'AUTH_TOKEN_URL',
  'AUTH_SCOPE',
  'AUTH_CLIENT_ID',
  'AUTH_CLIENT_SECRET',
  'WALLET_GATEWAY_UPSTREAM_URL',
  'CANTON_ENVIRONMENT',
] as const

const snapshot = (): Record<string, string | undefined> =>
  Object.fromEntries(CONFIG_VARS.map((name) => [name, process.env[name]]))

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
    for (const name of CONFIG_VARS) {
      delete process.env[name]
    }
  })

  afterEach(() => {
    restore(saved)
  })

  it('loads LocalNet values directly from the service environment', () => {
    // Scenario: wallet-gateway-devkit is configured like any other service.
    // The selected endpoints and auth recipe are direct env values, with no
    // CANTON_ENVIRONMENT indirection or environment JSON lookup.
    process.env.NETWORK = 'canton:localnet'
    process.env.CANTON_JSON_API_URL = 'http://host.docker.internal:2975'
    process.env.CANTON_LEDGER_API_URL = 'grpc://host.docker.internal:2901'
    process.env.CANTON_ADMIN_API_URL = 'grpc://host.docker.internal:2902'
    process.env.SPLICE_VALIDATOR_URL = 'http://host.docker.internal:2000/api/validator'
    process.env.SPLICE_SCAN_API_URL = 'http://host.docker.internal:4000/api/scan'
    process.env.SPLICE_REGISTRY_API_URL =
      'http://host.docker.internal:2000/api/validator/v0/scan-proxy'
    process.env.AUTH_MODE = 'self-signed'
    process.env.AUTH_AUDIENCE = 'https://canton.network.global'
    process.env.AUTH_SUBJECT = 'ledger-api-user'
    process.env.AUTH_SECRET = 'unsafe'
    process.env.WALLET_GATEWAY_UPSTREAM_URL = 'http://wallet-gateway:3030'

    const config = loadConfig()

    assert.equal(config.network, 'canton:localnet')
    assert.deepEqual(config.canton.auth, {
      mode: 'self-signed',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
      subject: 'ledger-api-user',
    })
    assert.equal(config.canton.jsonApiUrl, 'http://host.docker.internal:2975')
    assert.deepEqual(config.walletGateway, { upstreamUrl: 'http://wallet-gateway:3030' })
  })

  it('ignores CANTON_ENVIRONMENT because environments are not a devkit concept', () => {
    // Scenario: older branches selected config/environments/<name>.json. The
    // devkit should now ignore that selector and rely only on direct values in
    // env/.env.wallet-gateway-devkit.
    process.env.CANTON_ENVIRONMENT = '../secret'
    process.env.AUTH_MODE = 'static-token'
    process.env.AUTH_TOKEN = 'static.jwt.value'

    const config = loadConfig()

    assert.equal(config.network, 'canton:localnet')
    assert.deepEqual(config.canton.auth, { mode: 'static-token', token: 'static.jwt.value' })
  })

  it('requires direct static token auth values when AUTH_MODE is static-token', () => {
    // Scenario: static-token mode has no refresh recipe. The token must be
    // supplied in the devkit env file or exported by the operator.
    process.env.AUTH_MODE = 'static-token'

    assert.throws(() => loadConfig(), /AUTH_TOKEN is required for static-token auth/)
  })

  it('loads direct OAuth client credentials values', () => {
    // Scenario: external DevNet/TestNet stacks can use OAuth without adding a
    // repo-level environment selector. Every auth value comes from the devkit
    // service env file.
    process.env.AUTH_MODE = 'oauth-client-credentials'
    process.env.AUTH_TOKEN_URL = 'https://auth.example/token'
    process.env.AUTH_SCOPE = 'daml_ledger_api'
    process.env.AUTH_CLIENT_ID = 'devkit-client'
    process.env.AUTH_CLIENT_SECRET = 'devkit-secret'

    const config = loadConfig()

    assert.deepEqual(config.canton.auth, {
      mode: 'oauth-client-credentials',
      tokenUrl: 'https://auth.example/token',
      scope: 'daml_ledger_api',
      clientId: 'devkit-client',
      clientSecret: 'devkit-secret',
    })
  })

  it('requires direct OAuth client credentials fields', () => {
    // Scenario: OAuth mode is explicit. Missing client credentials should fail
    // before the service starts instead of falling back to a hidden config file.
    process.env.AUTH_MODE = 'oauth-client-credentials'
    process.env.AUTH_TOKEN_URL = 'https://auth.example/token'

    assert.throws(
      () => loadConfig(),
      /AUTH_CLIENT_ID is required for oauth-client-credentials auth/,
    )
  })

  it('keeps provider metadata local to the devkit env file', () => {
    // Scenario: provider metadata can be changed by editing the devkit service
    // env file. Legacy names are not normalized by hidden logic.
    process.env.AUTH_MODE = 'static-token'
    process.env.AUTH_TOKEN = 'static.jwt.value'
    process.env.PROVIDER_ID = 'custom-devkit'
    process.env.PROVIDER_URL = 'http://localhost:4311'
    process.env.PROVIDER_USER_URL = 'http://localhost:4311'

    const config = loadConfig()

    assert.equal(config.provider.id, 'custom-devkit')
    assert.equal(config.provider.url, 'http://localhost:4311')
    assert.equal(config.provider.userUrl, 'http://localhost:4311')
  })
})
