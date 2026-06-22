import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
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

type EnvironmentAuthConfig =
  | { mode: 'self-signed'; audience: string; subject?: string }
  | { mode: 'static-token' }
  | { mode: 'oauth-client-credentials'; tokenUrl: string; scope?: string }

type EnvironmentConfig = {
  network: string
  auth: EnvironmentAuthConfig
  canton: {
    jsonApiUrl: string
    ledgerApiUrl: string
    adminApiUrl: string
  }
  splice: {
    validatorUrl: string
    scanApiUrl: string
    registryApiUrl: string
  }
  provider?: {
    id?: string
    version?: string
    url?: string
    userUrl?: string
  }
  devkit?: {
    corsOrigins?: string[]
    walletGatewayUpstreamUrl?: string
  }
}

const optional = (name: string): string | undefined => {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

const defaultEnvironmentConfigDir = (): string =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../config/environments')

const requiredAuth = (name: string, environment: string, mode: string): string => {
  const value = optional(name)
  if (value === undefined) {
    throw new Error(`${name} is required for ${environment} ${mode} auth`)
  }
  return value
}

const requiredConfigString = (value: unknown, name: string): string => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} is required in environment config`)
  }
  return value
}

const optionalConfigString = (value: unknown, name: string): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  return requiredConfigString(value, name)
}

const optionalConfigStringArray = (value: unknown, name: string): string[] | undefined => {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    throw new Error(`${name} must be an array in environment config`)
  }
  return value.map((item, index) => requiredConfigString(item, `${name}[${index}]`))
}

const environmentName = (): string => {
  const name = optional('CANTON_ENVIRONMENT') ?? 'localnet'
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
    throw new Error(`Unsupported CANTON_ENVIRONMENT: ${name}`)
  }
  return name
}

// Loads the selected environment file without allowing path traversal.
const loadEnvironmentConfig = (environment: string): EnvironmentConfig => {
  const configDir = optional('CANTON_ENVIRONMENT_CONFIG_DIR') ?? defaultEnvironmentConfigDir()
  const filePath = path.join(configDir, `${environment}.json`)
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as EnvironmentConfig
  return {
    network: requiredConfigString(parsed.network, `${environment}.network`),
    auth: parsed.auth,
    canton: {
      jsonApiUrl: requiredConfigString(
        parsed.canton?.jsonApiUrl,
        `${environment}.canton.jsonApiUrl`,
      ),
      ledgerApiUrl: requiredConfigString(
        parsed.canton?.ledgerApiUrl,
        `${environment}.canton.ledgerApiUrl`,
      ),
      adminApiUrl: requiredConfigString(
        parsed.canton?.adminApiUrl,
        `${environment}.canton.adminApiUrl`,
      ),
    },
    splice: {
      validatorUrl: requiredConfigString(
        parsed.splice?.validatorUrl,
        `${environment}.splice.validatorUrl`,
      ),
      scanApiUrl: requiredConfigString(
        parsed.splice?.scanApiUrl,
        `${environment}.splice.scanApiUrl`,
      ),
      registryApiUrl: requiredConfigString(
        parsed.splice?.registryApiUrl,
        `${environment}.splice.registryApiUrl`,
      ),
    },
    provider: parsed.provider,
    devkit: {
      corsOrigins: optionalConfigStringArray(
        parsed.devkit?.corsOrigins,
        `${environment}.devkit.corsOrigins`,
      ),
      walletGatewayUpstreamUrl: optionalConfigString(
        parsed.devkit?.walletGatewayUpstreamUrl,
        `${environment}.devkit.walletGatewayUpstreamUrl`,
      ),
    },
  }
}

// Combines public environment metadata with runtime-only auth secrets.
const loadAuthConfig = (environment: string, config: EnvironmentAuthConfig): CantonAuthConfig => {
  switch (config.mode) {
    case 'static-token':
      return {
        mode: config.mode,
        token: requiredAuth('CANTON_AUTH_TOKEN', environment, config.mode),
      }
    case 'self-signed':
      return {
        mode: config.mode,
        audience: requiredConfigString(config.audience, `${environment}.auth.audience`),
        secret: requiredAuth('CANTON_AUTH_SECRET', environment, config.mode),
        subject: config.subject ?? 'ledger-api-user',
      }
    case 'oauth-client-credentials': {
      return {
        mode: config.mode,
        tokenUrl: requiredConfigString(config.tokenUrl, `${environment}.auth.tokenUrl`),
        clientId: requiredAuth('CANTON_OAUTH_CLIENT_ID', environment, config.mode),
        clientSecret: requiredAuth('CANTON_OAUTH_CLIENT_SECRET', environment, config.mode),
        ...(config.scope === undefined ? {} : { scope: config.scope }),
      }
    }
    default:
      throw new Error(
        `Unsupported auth mode in ${environment}: ${(config as { mode?: unknown }).mode}`,
      )
  }
}

export const loadConfig = (): WalletGatewayDevkitConfig => {
  const environment = environmentName()
  const environmentConfig = loadEnvironmentConfig(environment)
  return {
    port: 3010,
    corsOrigins: environmentConfig.devkit?.corsOrigins ?? ['http://localhost:3013'],
    network: environmentConfig.network,
    provider: {
      id: environmentConfig.provider?.id ?? 'wallet-gateway-devkit',
      version: environmentConfig.provider?.version ?? '0.1.0',
      url: environmentConfig.provider?.url ?? 'http://localhost:3011',
      userUrl: environmentConfig.provider?.userUrl ?? 'http://localhost:3011',
    },
    canton: {
      jsonApiUrl: environmentConfig.canton.jsonApiUrl,
      ledgerApiUrl: environmentConfig.canton.ledgerApiUrl,
      adminApiUrl: environmentConfig.canton.adminApiUrl,
      auth: loadAuthConfig(environment, environmentConfig.auth),
    },
    splice: environmentConfig.splice,
    walletGateway:
      environmentConfig.devkit?.walletGatewayUpstreamUrl === undefined
        ? undefined
        : { upstreamUrl: environmentConfig.devkit.walletGatewayUpstreamUrl },
  }
}
