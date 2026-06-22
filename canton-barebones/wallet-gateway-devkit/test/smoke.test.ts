import { strict as assert } from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { loadConfig } from '../src/config.ts'

const CANTON_VARS = [
  'CANTON_ENVIRONMENT',
  'CANTON_ENVIRONMENT_CONFIG_DIR',
  'CANTON_AUTH_TOKEN',
  'CANTON_AUTH_SECRET',
  'CANTON_OAUTH_CLIENT_ID',
  'CANTON_OAUTH_CLIENT_SECRET',
  'WALLET_GATEWAY_UPSTREAM_URL',
  'WALLET_GATEWAY_DEVKIT_CORS_ORIGINS',
  'WALLET_PROVIDER_ID',
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
  let tempDirs: string[]

  beforeEach(() => {
    saved = snapshot()
    tempDirs = []
    for (const name of CANTON_VARS) {
      delete process.env[name]
    }
  })

  afterEach(() => {
    restore(saved)
    for (const dir of tempDirs) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  const writeEnvironmentConfig = (environment: string, config: unknown): void => {
    // Scenario setup: tests use isolated environment config dirs so selected
    // DevNet/TestNet recipes cannot leak into the committed LocalNet defaults.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-gateway-devkit-env-'))
    tempDirs.push(dir)
    fs.writeFileSync(path.join(dir, `${environment}.json`), JSON.stringify(config))
    process.env.CANTON_ENVIRONMENT_CONFIG_DIR = dir
    process.env.CANTON_ENVIRONMENT = environment
  }

  it('defaults real mode to LocalNet self-signed auth', () => {
    // Scenario: LocalNet should be selected by one environment name. Endpoints
    // and the public JWT recipe come from the committed config file; only the
    // signing secret is injected through the process environment.
    process.env.CANTON_AUTH_SECRET = 'unsafe'

    const config = loadConfig()

    assert.equal(config.network, 'canton:localnet')
    assert.deepEqual(config.canton.auth, {
      mode: 'self-signed',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
      subject: 'ledger-api-user',
    })
    assert.equal(config.canton.jsonApiUrl, 'http://host.docker.internal:2975')
    assert.equal(config.provider.url, 'http://localhost:3011')
    assert.deepEqual(config.corsOrigins, ['http://localhost:3013'])
  })

  it('fails clearly when self-signed auth misses the LocalNet signing recipe', () => {
    // Scenario: LocalNet keeps the unsafe signing secret out of the committed
    // environment file. Missing secret configuration must fail before boot.
    assert.throws(
      () => loadConfig(),
      /CANTON_AUTH_SECRET is required for localnet self-signed auth/,
    )
  })

  it('reads static-token auth from the selected environment file and secret env', () => {
    // Scenario: a selected environment can declare static-token auth while the
    // bearer token remains outside versioned config.
    writeEnvironmentConfig('testnet', {
      network: 'canton:testnet',
      auth: { mode: 'static-token' },
      canton: {
        jsonApiUrl: 'https://json.testnet.example',
        ledgerApiUrl: 'grpcs://ledger.testnet.example',
        adminApiUrl: 'grpcs://admin.testnet.example',
      },
      splice: {
        validatorUrl: 'https://validator.testnet.example/api/validator',
        scanApiUrl: 'https://scan.testnet.example/api/scan',
        registryApiUrl: 'https://registry.testnet.example/api/registry',
      },
    })
    process.env.CANTON_AUTH_TOKEN = 'static.jwt.value'

    const config = loadConfig()

    assert.equal(config.network, 'canton:testnet')
    assert.deepEqual(config.canton.auth, {
      mode: 'static-token',
      token: 'static.jwt.value',
    })
  })

  it('requires CANTON_AUTH_TOKEN for static-token auth', () => {
    // Scenario: static-token mode declares no refresh recipe. Missing token
    // secret configuration should fail before the service starts.
    writeEnvironmentConfig('testnet', {
      network: 'canton:testnet',
      auth: { mode: 'static-token' },
      canton: { jsonApiUrl: 'x', ledgerApiUrl: 'y', adminApiUrl: 'z' },
      splice: { validatorUrl: 'v', scanApiUrl: 's', registryApiUrl: 'r' },
    })

    assert.throws(() => loadConfig(), /CANTON_AUTH_TOKEN is required for testnet static-token auth/)
  })

  it('reads OAuth endpoint config from the selected environment and secrets from env', () => {
    // Scenario: DevNet/TestNet deployments can version token endpoints and
    // scopes while injecting only OAuth client credentials at runtime.
    writeEnvironmentConfig('devnet', {
      network: 'canton:devnet',
      auth: {
        mode: 'oauth-client-credentials',
        tokenUrl: 'https://auth.example/token',
        scope: 'daml_ledger_api',
      },
      canton: {
        jsonApiUrl: 'https://json.devnet.example',
        ledgerApiUrl: 'grpcs://ledger.devnet.example',
        adminApiUrl: 'grpcs://admin.devnet.example',
      },
      splice: {
        validatorUrl: 'https://validator.devnet.example/api/validator',
        scanApiUrl: 'https://scan.devnet.example/api/scan',
        registryApiUrl: 'https://registry.devnet.example/api/registry',
      },
    })
    process.env.CANTON_OAUTH_CLIENT_ID = 'devkit-client'
    process.env.CANTON_OAUTH_CLIENT_SECRET = 'devkit-secret'

    const config = loadConfig()

    assert.deepEqual(config.canton.auth, {
      mode: 'oauth-client-credentials',
      tokenUrl: 'https://auth.example/token',
      clientId: 'devkit-client',
      clientSecret: 'devkit-secret',
      scope: 'daml_ledger_api',
    })
    assert.equal(config.canton.jsonApiUrl, 'https://json.devnet.example')
  })

  it('requires OAuth client credentials fields for OAuth auth', () => {
    // Scenario: OAuth endpoint metadata is versioned, but client credentials
    // are secrets and must still be supplied by the runtime environment.
    writeEnvironmentConfig('devnet', {
      network: 'canton:devnet',
      auth: { mode: 'oauth-client-credentials', tokenUrl: 'https://auth.example/token' },
      canton: { jsonApiUrl: 'x', ledgerApiUrl: 'y', adminApiUrl: 'z' },
      splice: { validatorUrl: 'v', scanApiUrl: 's', registryApiUrl: 'r' },
    })

    assert.throws(
      () => loadConfig(),
      /CANTON_OAUTH_CLIENT_ID is required for devnet oauth-client-credentials auth/,
    )
  })

  it('rejects unsafe environment names', () => {
    // Scenario: CANTON_ENVIRONMENT selects a local JSON file. Rejecting path
    // separators prevents selecting files outside the config directory.
    process.env.CANTON_ENVIRONMENT = '../secret'

    assert.throws(() => loadConfig(), /Unsupported CANTON_ENVIRONMENT: \.\.\/secret/)
  })

  it('loads Splice service URLs from the selected environment file', () => {
    // Scenario: Carpincho keeps one gateway URL while devkit gets every
    // Canton, Scan, validator, and registry endpoint from the selected env.
    process.env.CANTON_AUTH_SECRET = 'unsafe'

    const config = loadConfig()

    assert.deepEqual(config.splice, {
      validatorUrl: 'http://host.docker.internal:2000/api/validator',
      scanApiUrl: 'http://host.docker.internal:4000/api/scan',
      registryApiUrl: 'http://host.docker.internal:2000/api/validator/v0/scan-proxy',
    })
  })

  it('ignores stale provider id environment values', () => {
    // Scenario: provider metadata is selected from the environment JSON. Local
    // .env files from older branches must not rename the public provider.
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    process.env.WALLET_PROVIDER_ID = 'wallet-service'

    const config = loadConfig()

    assert.equal(config.provider.id, 'wallet-gateway-devkit')
  })

  it('reads the upstream wallet-gateway URL from the selected environment config', () => {
    // Scenario: devkit mode is a facade in front of the official wallet-gateway.
    // The upstream URL is versioned with the selected environment so Docker
    // does not need to pass service topology as an environment variable.
    process.env.CANTON_AUTH_SECRET = 'unsafe'

    const config = loadConfig()

    assert.deepEqual(config.walletGateway, {
      upstreamUrl: 'http://wallet-gateway:3030',
    })
  })

  it('ignores stale service defaults from environment variables', () => {
    // Scenario: old .env files may still contain pre-config-file service
    // defaults. Environment JSON must remain the source of truth.
    process.env.CANTON_AUTH_SECRET = 'unsafe'
    process.env.WALLET_GATEWAY_UPSTREAM_URL = 'http://old-upstream:3030'
    process.env.WALLET_GATEWAY_DEVKIT_CORS_ORIGINS = 'http://old-carpincho:3011'

    const config = loadConfig()

    assert.deepEqual(config.walletGateway, {
      upstreamUrl: 'http://wallet-gateway:3030',
    })
    assert.deepEqual(config.corsOrigins, ['http://localhost:3013'])
  })
})
