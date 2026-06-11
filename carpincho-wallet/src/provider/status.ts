import { getWalletServiceNetworkId, walletServiceStatus } from '@/api/walletService'
import { SIGNING_PROVIDER_ID } from '@/provider/accounts'

export interface ProviderStatus {
  provider: { id: string; version: string; providerType: 'browser' }
  connection: { isConnected: true; isNetworkConnected: boolean; networkReason?: string }
  network?: { networkId: string }
}

// Builds the browser provider status from wallet-service without inventing a local network.
export const buildStatus = async (): Promise<ProviderStatus> => {
  const remote = await walletServiceStatus()
  const networkId = remote.network?.networkId?.trim()
  return {
    provider: { id: SIGNING_PROVIDER_ID, version: __APP_VERSION__, providerType: 'browser' },
    connection: {
      isConnected: true,
      isNetworkConnected: remote.connection?.isNetworkConnected ?? false,
      ...(remote.connection?.networkReason === undefined
        ? {}
        : { networkReason: remote.connection.networkReason }),
    },
    ...(networkId === undefined || networkId === '' ? {} : { network: { networkId } }),
  }
}

// Resolves getActiveNetwork through wallet-service status, matching wallet-gateway's source.
export const getActiveNetwork = async (): Promise<{ networkId: string }> => ({
  networkId: await getWalletServiceNetworkId(),
})
