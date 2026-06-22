import type { CantonAuthConfig } from './auth.ts'

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
    auth: CantonAuthConfig
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

type AuthMode = 'self-signed' | 'static-token' | 'oauth-client-credentials'

// Treats empty strings as absent so env files can leave optional values blank.
const optional = (name: string): string | undefined => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

// Fails startup early when a selected mode lacks a required env value.
const required = (name: string, context: string): string => {
  const value = optional(name)
  if (value === undefined) {
    throw new Error(`${name} is required for ${context}`)
  }
  return value
}

// Keeps public ports explicit and rejects invalid service env overrides.
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

// Parses comma lists used by CORS without accepting empty origins.
const csv = (name: string, fallback: string[]): string[] => {
  const value = optional(name)
  if (value === undefined) {
    return fallback
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

// Restricts auth to the three supported runtime recipes.
const authMode = (): AuthMode => {
  const mode = optional('AUTH_MODE') ?? 'self-signed'
  if (mode !== 'self-signed' && mode !== 'static-token' && mode !== 'oauth-client-credentials') {
    throw new Error(`Unsupported AUTH_MODE: ${mode}`)
  }
  return mode
}

// Resolves the Canton auth recipe from the devkit service env file.
const loadAuthConfig = (): CantonAuthConfig => {
  const mode = authMode()
  switch (mode) {
    case 'static-token':
      return {
        mode,
        token: required('AUTH_TOKEN', `${mode} auth`),
      }
    case 'self-signed':
      return {
        mode,
        audience: optional('AUTH_AUDIENCE') ?? 'https://canton.network.global',
        secret: required('AUTH_SECRET', `${mode} auth`),
        subject: optional('AUTH_SUBJECT') ?? 'ledger-api-user',
      }
    case 'oauth-client-credentials': {
      return {
        mode,
        tokenUrl: required('AUTH_TOKEN_URL', `${mode} auth`),
        clientId: required('AUTH_CLIENT_ID', `${mode} auth`),
        clientSecret: required('AUTH_CLIENT_SECRET', `${mode} auth`),
        ...(optional('AUTH_SCOPE') === undefined ? {} : { scope: optional('AUTH_SCOPE') }),
      }
    }
  }
}

// Builds the runtime config directly from the devkit service env file.
export const loadConfig = (): WalletGatewayDevkitConfig => ({
  port: optionalNumber('PORT', 3010),
  corsOrigins: csv('CORS_ORIGINS', ['http://localhost:3013']),
  network: optional('NETWORK') ?? 'canton:localnet',
  provider: {
    id: optional('PROVIDER_ID') ?? 'wallet-gateway-devkit',
    version: optional('PROVIDER_VERSION') ?? '0.1.0',
    url: optional('PROVIDER_URL') ?? 'http://localhost:3011',
    userUrl: optional('PROVIDER_USER_URL') ?? 'http://localhost:3011',
  },
  canton: {
    jsonApiUrl: optional('CANTON_JSON_API_URL') ?? 'http://host.docker.internal:2975',
    ledgerApiUrl: optional('CANTON_LEDGER_API_URL') ?? 'grpc://host.docker.internal:2901',
    adminApiUrl: optional('CANTON_ADMIN_API_URL') ?? 'grpc://host.docker.internal:2902',
    auth: loadAuthConfig(),
  },
  splice: {
    validatorUrl:
      optional('SPLICE_VALIDATOR_URL') ?? 'http://host.docker.internal:2000/api/validator',
    scanApiUrl: optional('SPLICE_SCAN_API_URL') ?? 'http://host.docker.internal:4000/api/scan',
    registryApiUrl:
      optional('SPLICE_REGISTRY_API_URL') ??
      'http://host.docker.internal:2000/api/validator/v0/scan-proxy',
  },
  walletGateway:
    optional('WALLET_GATEWAY_UPSTREAM_URL') === undefined
      ? undefined
      : { upstreamUrl: optional('WALLET_GATEWAY_UPSTREAM_URL')! },
})
