import { createCantonToken } from './canton-token.ts'
import { isMockEnabled } from './mock.ts'

export type TokenSource = 'env' | 'mint' | 'none'

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
    backendUserId: string
    backendToken?: string
    tokenSource: TokenSource
  }
}

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

const resolveToken = (backendUserId: string): { token?: string; source: TokenSource } => {
  if (isMockEnabled()) {
    return { source: 'none' }
  }
  const explicit = optional('CANTON_BACKEND_TOKEN')
  if (explicit !== undefined) {
    return { token: explicit, source: 'env' }
  }
  const audience = optional('CANTON_AUTH_AUDIENCE')
  const secret = optional('CANTON_AUTH_SECRET')
  if (audience !== undefined && secret !== undefined) {
    return {
      token: createCantonToken({ subject: backendUserId, audience, secret }),
      source: 'mint',
    }
  }
  return { source: 'none' }
}

export const loadConfig = (): WalletServiceConfig => {
  const backendUserId = optional('CANTON_BACKEND_USER_ID') ?? 'wallet-service'
  const resolved = resolveToken(backendUserId)
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
      jsonApiUrl: optional('CANTON_JSON_API_URL') ?? 'http://localhost:3013',
      ledgerApiUrl: optional('CANTON_LEDGER_API_URL') ?? 'grpc://localhost:3014',
      adminApiUrl: optional('CANTON_ADMIN_API_URL') ?? 'grpc://localhost:3015',
      backendUserId,
      backendToken: resolved.token,
      tokenSource: resolved.source,
    },
  }
}
