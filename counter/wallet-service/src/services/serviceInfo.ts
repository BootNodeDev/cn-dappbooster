import type { WalletServiceConfig } from '../config.js'

export const network = (config: WalletServiceConfig): Record<string, unknown> => ({
  networkId: config.network
})

export const provider = (config: WalletServiceConfig): Record<string, unknown> => ({
  id: config.provider.id,
  version: config.provider.version,
  providerType: 'remote',
  ...(config.provider.url === undefined ? {} : { url: config.provider.url }),
  ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl })
})

export const serviceInfo = (config: WalletServiceConfig): Record<string, unknown> => ({
  service: 'counter-wallet-service',
  rpcEndpoint: '/rpc',
  api: 'Carpincho service bridge over JSON-RPC 2.0',
  dappApi: 'CIP-0103 is exposed by Carpincho over WalletConnect; this service has no signer.',
  supportedMethods: [
    'status',
    'connect',
    'disconnect',
    'isConnected',
    'getActiveNetwork',
    'listAccounts',
    'getPrimaryAccount',
    'ledgerApi',
    'prepareTransaction',
    'executePrepared',
    'prepareCreateParty',
    'completeCreateParty'
  ],
  reservedMethods: ['prepareExecute', 'prepareExecuteAndWait', 'signMessage'],
  network: config.network,
  provider: provider(config),
  canton: {
    jsonApiUrl: config.canton.jsonApiUrl,
    ledgerApiUrl: config.canton.ledgerApiUrl,
    adminApiUrl: config.canton.adminApiUrl,
    backendUserId: config.canton.backendUserId,
    hasBackendToken: config.canton.backendToken !== undefined
  }
})
