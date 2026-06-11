// The backend construction point. createBackend builds a LiteBackend from a
// resolved deployment config. loadBackendConfig fetches the slim deployment JSON
// {pkg, operator, rpcUrl} that the bootstrap writes into /public.

import type { Wallet } from '@/wallet/Wallet'
import { LiteBackend } from './LiteBackend'
import type { Deployment, VestingBackend } from './VestingBackend'

export type BackendConfig = { rpcUrl: string; deployment: Deployment }

const DEFAULT_RPC_URL = 'http://localhost:3010/rpc'

const CONFIG_FILE = '/vesting-lite-parties.json'

const EMPTY: BackendConfig = { rpcUrl: '', deployment: { pkg: '', operator: '' } }

type ConfigFile = { pkg?: string; operator?: string; rpcUrl?: string }

// Load the deployment metadata. Returns an empty/unavailable config when the file
// is absent or malformed.
export const loadBackendConfig = async (): Promise<BackendConfig> => {
  try {
    const response = await fetch(CONFIG_FILE)
    if (!response.ok) {
      return EMPTY
    }
    const data = (await response.json()) as ConfigFile
    return {
      rpcUrl: data.rpcUrl ?? DEFAULT_RPC_URL,
      deployment: { pkg: data.pkg ?? '', operator: data.operator ?? '' },
    }
  } catch {
    return EMPTY
  }
}

export const createBackend = (config: BackendConfig, wallet: Wallet): VestingBackend =>
  new LiteBackend(config.rpcUrl, config.deployment, wallet)
