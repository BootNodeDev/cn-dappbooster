// createBackend: loads /amulet-parties.json and builds the sole AmuletBackend.
// The config file is written by the amulet-vesting bootstrap; do NOT commit it.

import type { SubmitFn } from '@/wallet/Wallet'
import { AmuletBackend } from './AmuletBackend'
import type { Deployment, VestingBackend } from './VestingBackend'

export type BackendConfig = { rpcUrl: string; deployment: Deployment }

const DEFAULT_RPC_URL = 'http://localhost:3010/rpc'

const CONFIG_FILE = '/amulet-parties.json'

const EMPTY: BackendConfig = { rpcUrl: '', deployment: { pkg: '', operator: '' } }

type ConfigFile = { pkg?: string; operator?: string; rpcUrl?: string; splicePkg?: string }

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
      deployment: {
        pkg: data.pkg ?? '',
        operator: data.operator ?? '',
        splicePkg: data.splicePkg,
      },
    }
  } catch {
    return EMPTY
  }
}

export const createBackend = (config: BackendConfig, submit: SubmitFn): VestingBackend =>
  new AmuletBackend(config.rpcUrl, config.deployment, submit)
