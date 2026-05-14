import type { WalletServiceConfig } from '../config.js'

const ledgerJsonApiVersion = async (config: WalletServiceConfig): Promise<{ connected: boolean; reason?: string }> => {
  try {
    const response = await fetch(`${config.canton.jsonApiUrl.replace(/\/$/, '')}/v2/version`, {
      signal: AbortSignal.timeout(1000)
    })
    return response.ok
      ? { connected: true }
      : { connected: false, reason: `Ledger API returned HTTP ${response.status}` }
  } catch (error) {
    return { connected: false, reason: (error as Error).message }
  }
}

export const connectResult = async (config: WalletServiceConfig): Promise<Record<string, unknown>> => {
  const network = await ledgerJsonApiVersion(config)
  return {
    isConnected: false,
    reason: 'No wallet session/account implementation yet.',
    isNetworkConnected: network.connected,
    ...(network.reason === undefined ? {} : { networkReason: network.reason }),
    ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl })
  }
}
