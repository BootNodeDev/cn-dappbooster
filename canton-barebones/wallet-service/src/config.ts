import type { FiveNorthAuthConfig } from './fivenorthToken.ts'
import { isMockEnabled } from './mock.ts'

export type TokenSource = 'fivenorth' | 'none'

export interface WalletServiceConfig {
  port: number
  corsOrigins: string[]
  network: string
  provider: {
    id: string
    version: string
    url?: string
    userUrl?: string
  }
  canton: {
    jsonApiUrl: string
    ledgerApiUrl: string
    adminApiUrl: string
    auth?: FiveNorthAuthConfig
    tokenSource: TokenSource
  }
  splice: {
    validatorUrl: string
    registryApiUrl: string
  }
}

const DEFAULT_FIVENORTH_AUTH_URL = 'https://auth.sandbox.fivenorth.io/application/o/token/'
const DEFAULT_FIVENORTH_CLIENT_ID = 'validator-devnet-m2m'
const DEFAULT_FIVENORTH_SCOPE = 'daml_ledger_api'
const DEFAULT_CANTON_JSON_API_URL = 'https://ledger-api.validator.devnet.sandbox.fivenorth.io'
const DEFAULT_SPLICE_VALIDATOR_URL =
  'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator'
const DEFAULT_SPLICE_REGISTRY_API_URL =
  'https://wallet.validator.devnet.sandbox.fivenorth.io/api/validator/v0/scan-proxy'
const TOKEN_REFRESH_SKEW_MS = 60_000

const optional = (name: string): string | undefined => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

const optionalNumber = (name: string, fallback: number): number => {
  const value = optional(name)
  if (value === undefined) {
    return fallback
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return parsed
}

// Resolves FiveNorth runtime auth while keeping mock mode credential-free.
const resolveAuth = (): { auth?: FiveNorthAuthConfig; source: TokenSource } => {
  if (isMockEnabled()) {
    return { source: 'none' }
  }
  const clientSecret = optional('FIVENORTH_CLIENT_SECRET')
  if (clientSecret === undefined) {
    throw new Error('FIVENORTH_CLIENT_SECRET is required for FiveNorth token refresh')
  }
  return {
    source: 'fivenorth',
    auth: {
      tokenUrl: optional('FIVENORTH_AUTH_URL') ?? DEFAULT_FIVENORTH_AUTH_URL,
      clientId: optional('FIVENORTH_CLIENT_ID') ?? DEFAULT_FIVENORTH_CLIENT_ID,
      clientSecret,
      scope: optional('FIVENORTH_SCOPE') ?? DEFAULT_FIVENORTH_SCOPE,
      refreshSkewMs: TOKEN_REFRESH_SKEW_MS,
    },
  }
}

export const loadConfig = (): WalletServiceConfig => {
  const resolved = resolveAuth()
  return {
    port: optionalNumber('WALLET_SERVICE_PORT', 3010),
    corsOrigins: (
      optional('WALLET_SERVICE_CORS_ORIGINS') ??
      optional('WALLET_SERVICE_CORS_ORIGIN') ??
      'http://localhost:3011'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    network: optional('NETWORK') ?? 'canton:local',
    provider: {
      id: optional('WALLET_PROVIDER_ID') ?? 'wallet-service',
      version: optional('WALLET_PROVIDER_VERSION') ?? '0.1.0',
      url: optional('WALLET_PROVIDER_URL') ?? 'http://localhost:3010',
      userUrl: optional('WALLET_PROVIDER_USER_URL') ?? 'http://localhost:3010',
    },
    canton: {
      jsonApiUrl: optional('CANTON_JSON_API_URL') ?? DEFAULT_CANTON_JSON_API_URL,
      ledgerApiUrl: optional('CANTON_LEDGER_API_URL') ?? DEFAULT_CANTON_JSON_API_URL,
      adminApiUrl: optional('CANTON_ADMIN_API_URL') ?? '',
      auth: resolved.auth,
      tokenSource: resolved.source,
    },
    splice: {
      validatorUrl: optional('SPLICE_VALIDATOR_URL') ?? DEFAULT_SPLICE_VALIDATOR_URL,
      registryApiUrl: optional('SPLICE_REGISTRY_API_URL') ?? DEFAULT_SPLICE_REGISTRY_API_URL,
    },
  }
}
