import type { AccountPublic } from '@/vault/types'

export const SIGNING_PROVIDER_ID = 'carpincho-wallet'

export interface Cip103WalletAccount {
  primary: boolean
  partyId: string
  status: 'allocated'
  hint: string
  publicKey: string
  namespace: string
  networkId: string
  signingProviderId: string
}

export const partyNamespace = (partyId: string): string => {
  const idx = partyId.indexOf('::')
  return idx === -1 ? '' : partyId.slice(idx + 2)
}

export const accountToCip103Wallet = (account: AccountPublic): Cip103WalletAccount => ({
  primary: account.isPrimary,
  partyId: account.partyId,
  status: 'allocated',
  hint: account.name,
  publicKey: account.publicKeyBase64,
  namespace: partyNamespace(account.partyId),
  networkId: account.network,
  signingProviderId: SIGNING_PROVIDER_ID,
})
