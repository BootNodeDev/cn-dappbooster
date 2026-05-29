import type { SDK } from '@canton-network/wallet-sdk'
import type { WalletServiceConfig } from './config.ts'
import type { PendingStore } from './rpc.ts'
import { createPendingStore, InvalidParams } from './rpc.ts'

type WalletSdk = Awaited<ReturnType<typeof SDK.create>>
type PreparedExternalPartyCreation = ReturnType<WalletSdk['party']['external']['create']>

export type PartyApi = {
  prepare: (params: { publicKeyBase64?: string; partyHint?: string }) => Promise<unknown>
  complete: (params: {
    onboardingId?: string
    signatureBase64?: string
    expectHeavyLoad?: boolean
  }) => Promise<unknown>
  pendingSize: () => number
}

type PartyApiDeps = {
  getSdk: () => Promise<WalletSdk>
  store?: PendingStore<PreparedExternalPartyCreation>
}

export const createPartyApi = (_config: WalletServiceConfig, deps: PartyApiDeps): PartyApi => {
  const store =
    deps.store ??
    createPendingStore<PreparedExternalPartyCreation>({
      ttlMs: 5 * 60_000,
      maxSize: 32,
    })

  const prepare = async (params: {
    publicKeyBase64?: string
    partyHint?: string
  }): Promise<unknown> => {
    if (params.publicKeyBase64 === undefined || params.publicKeyBase64.trim() === '') {
      throw new InvalidParams('publicKeyBase64 is required')
    }
    const partyHint = params.partyHint?.trim()
    if (partyHint === '') {
      throw new InvalidParams('partyHint cannot be empty')
    }
    const sdk = await deps.getSdk()
    const prepared = sdk.party.external.create(params.publicKeyBase64, {
      ...(partyHint === undefined ? {} : { partyHint }),
    })
    const topology = await prepared.topology()
    const onboardingId = crypto.randomUUID()
    store.set(onboardingId, prepared)
    return { onboardingId, ...topology }
  }

  const complete = async (params: {
    onboardingId?: string
    signatureBase64?: string
    expectHeavyLoad?: boolean
  }): Promise<unknown> => {
    if (params.onboardingId === undefined || params.onboardingId.length === 0) {
      throw new InvalidParams('onboardingId is required')
    }
    if (params.signatureBase64 === undefined || params.signatureBase64.length === 0) {
      throw new InvalidParams('signatureBase64 is required')
    }
    const prepared = store.get(params.onboardingId)
    if (prepared === undefined) {
      throw new InvalidParams('party onboarding request not found or expired')
    }
    try {
      return await prepared.execute(params.signatureBase64, {
        expectHeavyLoad: params.expectHeavyLoad,
        grantUserRights: true,
      })
    } finally {
      store.delete(params.onboardingId)
    }
  }

  return { prepare, complete, pendingSize: () => store.size() }
}
