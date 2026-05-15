import type { DappClient as DappClientType } from '@canton-network/dapp-sdk'
import type { ProviderType, RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'
import type { Provider } from '@canton-network/core-splice-provider'
import { createExtensionWalletProvider } from './extensionProvider.ts'
import { selectWalletAccount, type WalletAccount } from './walletAccount.ts'
import { createWalletConnectProvider } from './walletConnectProvider.ts'

export type { WalletAccount } from './walletAccount.ts'

export interface WalletConnection {
  client: DappClientType
  account: WalletAccount
}

export interface ConnectWalletArgs {
  chainId: string
  onUri: (uri: string) => void
  extensionProviderFactory?: () => Promise<Provider<DappRpcTypes> | undefined>
  walletConnectProviderFactory?: () => Provider<DappRpcTypes>
}

export interface PreferredProvider {
  provider: Provider<DappRpcTypes>
  providerType: ProviderType
}

const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

const walletConnectProjectId = (): string => {
  const value = envString('VITE_WC_PROJECT_ID')
  if (value === '') {
    throw new Error('VITE_WC_PROJECT_ID is not set')
  }
  return value
}

export const connectWallet = async (args: ConnectWalletArgs): Promise<WalletConnection> => {
  const selected = await createPreferredProvider(args)
  const { DappClient } = await import('@canton-network/dapp-sdk')
  const client = new DappClient(selected.provider, {
    providerType: selected.providerType,
    injectGlobal: false
  })
  const connection = await client.connect()
  if (!connection.isConnected) {
    throw new Error(connection.reason ?? 'Wallet did not connect')
  }
  const accounts = await client.listAccounts() as WalletAccount[]
  const account = selectWalletAccount(accounts)
  if (account === undefined) {
    await client.disconnect().catch(() => undefined)
    throw new Error('Wallet connected without accounts')
  }
  return { client, account }
}

export const createPreferredProvider = async (args: ConnectWalletArgs): Promise<PreferredProvider> => {
  const extensionProvider = await (args.extensionProviderFactory?.() ?? createExtensionWalletProvider())
  if (extensionProvider !== undefined) {
    return {
      provider: extensionProvider,
      providerType: 'browser'
    }
  }
  return {
    provider: args.walletConnectProviderFactory?.() ?? createWalletConnectProvider({
      projectId: walletConnectProjectId(),
      chainId: args.chainId,
      metadata: {
        name: 'Counter dApp',
        description: 'Counter app for the Canton base',
        url: window.location.origin,
        icons: []
      },
      onUri: args.onUri
    }),
    providerType: 'remote'
  }
}
