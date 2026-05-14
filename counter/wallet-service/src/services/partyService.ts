import { objectParam } from './params.js'
import type { WalletSdk, WalletSdkService } from './walletSdk.js'

type PrepareCreatePartyParams = {
  publicKeyBase64?: string
  partyHint?: string
}

type CompleteCreatePartyParams = {
  onboardingId?: string
  signatureBase64?: string
  expectHeavyLoad?: boolean
}

type PreparedExternalPartyCreation = ReturnType<WalletSdk['party']['external']['create']>

export const createPartyService = ({ getSdk }: WalletSdkService) => {
  const pendingPartyCreations = new Map<string, PreparedExternalPartyCreation>()

  const prepareCreateParty = async (params: unknown): Promise<unknown> => {
    const p = objectParam<PrepareCreatePartyParams>(params, 'prepareCreateParty')
    if (p.publicKeyBase64 === undefined || p.publicKeyBase64.trim() === '') {
      throw new Error('publicKeyBase64 is required')
    }
    const partyHint = p.partyHint?.trim()
    if (partyHint === '') {
      throw new Error('partyHint cannot be empty')
    }
    const sdk = await getSdk()
    const prepared = sdk.party.external.create(p.publicKeyBase64, {
      ...(partyHint === undefined ? {} : { partyHint })
    })
    const topology = await prepared.topology()
    const onboardingId = crypto.randomUUID()
    pendingPartyCreations.set(onboardingId, prepared)
    return {
      onboardingId,
      ...topology
    }
  }

  const completeCreateParty = async (params: unknown): Promise<unknown> => {
    const p = objectParam<CompleteCreatePartyParams>(params, 'completeCreateParty')
    if (p.onboardingId === undefined || p.onboardingId.length === 0) {
      throw new Error('onboardingId is required')
    }
    if (p.signatureBase64 === undefined || p.signatureBase64.length === 0) {
      throw new Error('signatureBase64 is required')
    }
    const prepared = pendingPartyCreations.get(p.onboardingId)
    if (prepared === undefined) {
      throw new Error('party onboarding request not found or expired')
    }
    try {
      return await prepared.execute(p.signatureBase64, {
        expectHeavyLoad: p.expectHeavyLoad,
        grantUserRights: true
      })
    } finally {
      pendingPartyCreations.delete(p.onboardingId)
    }
  }

  return { prepareCreateParty, completeCreateParty }
}

export type PartyService = ReturnType<typeof createPartyService>
