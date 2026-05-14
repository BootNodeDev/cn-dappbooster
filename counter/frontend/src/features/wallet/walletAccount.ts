export interface WalletAccount {
  primary?: boolean
  partyId: string
  hint?: string
  publicKey?: string
  networkId?: string
}

export const selectWalletAccount = (accounts: WalletAccount[]): WalletAccount | undefined =>
  accounts.find(a => a.primary) ?? accounts[0]
