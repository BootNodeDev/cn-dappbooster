import type { AccountPublic } from '@/vault/types'

export interface AccountSnapshot {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export interface AccountConnectionInput {
  isNetworkConnected?: boolean
  networkReason?: string
}

export interface AccountConnection {
  isConnected: boolean
  isNetworkConnected: boolean
  reason?: string
  networkReason?: string
}

export const selectedAccount = (snapshot: AccountSnapshot): AccountPublic | undefined =>
  snapshot.primary ?? snapshot.accounts[0]

export const accountConnection = (
  snapshot: AccountSnapshot,
  remote: AccountConnectionInput,
): AccountConnection => ({
  isConnected: selectedAccount(snapshot) !== undefined,
  isNetworkConnected: remote.isNetworkConnected ?? false,
  ...(selectedAccount(snapshot) === undefined ? { reason: 'No wallet account available.' } : {}),
  ...(remote.networkReason === undefined ? {} : { networkReason: remote.networkReason }),
})
