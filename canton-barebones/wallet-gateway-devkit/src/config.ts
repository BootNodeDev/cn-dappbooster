export type TokenSource = 'env' | 'none'

export interface WalletGatewayDevkitConfig {
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
    backendToken?: string
    tokenSource: TokenSource
  }
  splice: {
    validatorUrl: string
    scanApiUrl: string
    registryApiUrl: string
  }
  walletGateway?: {
    upstreamUrl: string
  }
}

const optional = (name: string): string | undefined => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

// Reads the first configured alias so renamed env vars can coexist with local legacy files.
const optionalFirst = (...names: string[]): string | undefined => {
  for (const name of names) {
    const value = optional(name)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
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

// Preserves "first alias wins" for positive integer settings.
const optionalNumberFirst = (names: string[], fallback: number): number => {
  for (const name of names) {
    const value = optional(name)
    if (value !== undefined) {
      return optionalNumber(name, fallback)
    }
  }
  return fallback
}

// Converts the old generated default while preserving intentional custom ids.
const providerId = (): string => {
  const configured = optional('WALLET_PROVIDER_ID')
  return configured === undefined || configured === 'wallet-service'
    ? 'wallet-gateway-devkit'
    : configured
}

// Resolves the explicit runtime bearer token without exposing the local signing recipe to services.
const resolveToken = (): { token?: string; source: TokenSource } => {
  const explicit = optional('CANTON_BACKEND_TOKEN')
  if (explicit !== undefined) {
    return { token: explicit, source: 'env' }
  }
  throw new Error(
    'CANTON_BACKEND_TOKEN is required. Generate one with: npm run canton:token -- ledger-api-user',
  )
}

export const loadConfig = (): WalletGatewayDevkitConfig => {
  const resolved = resolveToken()
  return {
    port: optionalNumberFirst(['WALLET_GATEWAY_DEVKIT_PORT', 'WALLET_SERVICE_PORT'], 3010),
    corsOrigins: (
      optionalFirst(
        'WALLET_GATEWAY_DEVKIT_CORS_ORIGINS',
        'WALLET_GATEWAY_DEVKIT_CORS_ORIGIN',
        'WALLET_SERVICE_CORS_ORIGINS',
        'WALLET_SERVICE_CORS_ORIGIN',
      ) ?? 'http://localhost:3011'
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
    network: optional('NETWORK') ?? 'canton:local',
    provider: {
      id: providerId(),
      version: optional('WALLET_PROVIDER_VERSION') ?? '0.1.0',
      url: optional('WALLET_PROVIDER_URL') ?? 'http://localhost:3010',
      userUrl: optional('WALLET_PROVIDER_USER_URL') ?? 'http://localhost:3010',
    },
    canton: {
      jsonApiUrl: optional('CANTON_JSON_API_URL') ?? 'http://localhost:3013',
      ledgerApiUrl: optional('CANTON_LEDGER_API_URL') ?? 'grpc://localhost:3014',
      adminApiUrl: optional('CANTON_ADMIN_API_URL') ?? 'grpc://localhost:3015',
      backendToken: resolved.token,
      tokenSource: resolved.source,
    },
    splice: {
      validatorUrl: optional('SPLICE_VALIDATOR_URL') ?? 'http://localhost:2000/api/validator',
      scanApiUrl: optional('SPLICE_SCAN_API_URL') ?? 'http://scan.localhost:4000/api/scan',
      registryApiUrl:
        optional('SPLICE_REGISTRY_API_URL') ?? 'http://localhost:2000/api/validator/v0/scan-proxy',
    },
    walletGateway:
      optional('WALLET_GATEWAY_UPSTREAM_URL') === undefined
        ? undefined
        : { upstreamUrl: optional('WALLET_GATEWAY_UPSTREAM_URL')! },
  }
}
