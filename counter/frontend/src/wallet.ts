import { DappClient, WalletConnectAdapter } from '@canton-network/dapp-sdk'

export interface WalletAccount {
  primary?: boolean
  partyId: string
  hint?: string
  publicKey?: string
  networkId?: string
}

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
  const adapter = WalletConnectAdapter.create({
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
  const client = new DappClient(adapter.provider(), {
    providerType: 'remote',
    injectGlobal: false
  })
  const connection = await client.connect()
  if (!connection.isConnected) {
    throw new Error(connection.reason ?? 'Wallet did not connect')
  }
  const accounts = await client.listAccounts() as WalletAccount[]
  const account = accounts.find(a => a.primary) ?? accounts[0]
  if (account === undefined) {
    throw new Error('Wallet connected without accounts')
  }
  return { client, account }
}
