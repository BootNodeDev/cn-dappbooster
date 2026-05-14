import { DappClient } from '@canton-network/dapp-sdk'
import { selectWalletAccount, type WalletAccount } from './walletAccount.js'
import { createWalletConnectProvider } from './walletConnectProvider.js'

export type { WalletAccount } from './walletAccount.js'

export interface WalletConnection {
  client: DappClient
  account: WalletAccount
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

export const connectWallet = async (args: {
  chainId: string
  onUri: (uri: string) => void
}): Promise<WalletConnection> => {
  const provider = createWalletConnectProvider({
    projectId: walletConnectProjectId(),
    chainId: args.chainId,
    metadata: {
      name: 'Counter dApp',
      description: 'Counter app for the Canton base',
      url: window.location.origin,
      icons: []
    },
    onUri: args.onUri
  })
  const client = new DappClient(provider, {
    providerType: 'remote',
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
