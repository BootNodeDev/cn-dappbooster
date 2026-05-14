import { DappClient } from '@canton-network/dapp-sdk'
import { selectWalletAccount, type WalletAccount } from './walletAccount.js'
import { createWalletConnectProvider } from './walletConnectProvider.js'
import { walletConnectProjectId } from './walletEnv.js'

export interface WalletConnection {
  client: DappClient
  account: WalletAccount
}

export interface ConnectWalletArgs {
  chainId: string
  onUri: (uri: string) => void
}

const walletMetadata = (): {
  name: string
  description: string
  url: string
  icons: string[]
} => ({
  name: 'Counter dApp',
  description: 'Counter app for the Canton base',
  url: window.location.origin,
  icons: []
})

const createDappClient = (args: ConnectWalletArgs): DappClient => {
  const provider = createWalletConnectProvider({
    projectId: walletConnectProjectId(),
    chainId: args.chainId,
    metadata: walletMetadata(),
    onUri: args.onUri
  })

  return new DappClient(provider, {
    providerType: 'remote',
    injectGlobal: false
  })
}

const connectedAccount = async (client: DappClient): Promise<WalletAccount> => {
  const accounts = await client.listAccounts() as WalletAccount[]
  const account = selectWalletAccount(accounts)
  if (account !== undefined) {
    return account
  }

  await client.disconnect().catch(() => undefined)
  throw new Error('Wallet connected without accounts')
}

export const connectWallet = async (args: ConnectWalletArgs): Promise<WalletConnection> => {
  const client = createDappClient(args)
  const connection = await client.connect()
  if (!connection.isConnected) {
    throw new Error(connection.reason ?? 'Wallet did not connect')
  }

  return {
    client,
    account: await connectedAccount(client)
  }
}
