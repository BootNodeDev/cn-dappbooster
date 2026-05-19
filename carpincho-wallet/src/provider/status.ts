import { walletServiceRequest } from '@/api/walletService.ts'
import { loadRuntimeConfig } from '@/config/runtimeConfig.ts'
import { SIGNING_PROVIDER_ID } from '@/provider/accounts.ts'
import { CANTON_METHOD_STATUS } from '@/provider/methods.ts'

interface WalletServiceStatus {
  connection?: {
    isConnected?: boolean
    isNetworkConnected?: boolean
    reason?: string
    networkReason?: string
  }
  network?: {
    networkId?: string
  }
}

export interface ProviderStatus {
  provider: { id: string; version: string; providerType: 'browser' }
  connection: { isConnected: true; isNetworkConnected: boolean; networkReason?: string }
  network: { networkId: string }
}

export const normalizeCantonNetwork = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return 'canton:local'
  }
  return trimmed.startsWith('canton:') ? trimmed : `canton:${trimmed}`
}

export const getCantonNetwork = (): string =>
  normalizeCantonNetwork(loadRuntimeConfig().cantonNetwork)

export const buildStatus = async (): Promise<ProviderStatus> => {
  try {
    const remote = await walletServiceRequest<WalletServiceStatus>(CANTON_METHOD_STATUS)
    return {
      provider: { id: SIGNING_PROVIDER_ID, version: '0.1.0', providerType: 'browser' },
      connection: {
        isConnected: true,
        isNetworkConnected: remote.connection?.isNetworkConnected ?? false,
        ...(remote.connection?.networkReason === undefined
          ? {}
          : { networkReason: remote.connection.networkReason }),
      },
      network: { networkId: remote.network?.networkId ?? getCantonNetwork() },
    }
  } catch (error) {
    return {
      provider: { id: SIGNING_PROVIDER_ID, version: '0.1.0', providerType: 'browser' },
      connection: {
        isConnected: true,
        isNetworkConnected: false,
        networkReason: `wallet-service unavailable: ${(error as Error).message}`,
      },
      network: { networkId: getCantonNetwork() },
    }
  }
}
