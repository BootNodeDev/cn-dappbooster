import { executePreparedCommands } from '@/api/interactiveSubmission'
import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface AmuletPreapprovalStatus {
  active: boolean
  expired: boolean
  contractId?: string
  templateId?: string
  expiresAt?: string
}

interface AmuletPreapprovalCommands {
  commands: unknown
  disclosedContracts?: unknown[]
}

export interface AmuletPreapprovalActionParams {
  account: AccountPublic
  signMessage: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

// Reads the current Amulet auto-accept state for a receiver party.
export const getAmuletPreapprovalStatus = async (
  receiver: string,
): Promise<AmuletPreapprovalStatus> =>
  await walletServiceRequest<AmuletPreapprovalStatus>('amulet.preapproval.status', { receiver })

// Enables Amulet auto-accept while keeping the receiver signature inside Carpincho.
export const createAmuletPreapproval = async ({
  account,
  signMessage,
  recordTransaction,
}: AmuletPreapprovalActionParams): Promise<{ updateId?: string; completionOffset?: number }> => {
  const { commands, disclosedContracts } = await walletServiceRequest<AmuletPreapprovalCommands>(
    'amulet.preapproval.create',
    { receiver: account.partyId },
  )
  await executePreparedCommands({
    account,
    commands,
    disclosedContracts,
    method: 'amulet.preapproval.create',
    summary: 'Enable Amulet auto-accept',
    signMessage,
    recordTransaction,
  })
  return await walletServiceRequest<{ updateId?: string; completionOffset?: number }>(
    'amulet.preapproval.acceptProposal',
    { receiver: account.partyId },
  )
}

// Disables Amulet auto-accept while keeping the receiver signature inside Carpincho.
export const cancelAmuletPreapproval = async ({
  account,
  signMessage,
  recordTransaction,
}: AmuletPreapprovalActionParams): Promise<{ updateId?: string; completionOffset?: number }> => {
  const { commands, disclosedContracts } = await walletServiceRequest<AmuletPreapprovalCommands>(
    'amulet.preapproval.cancel',
    { receiver: account.partyId },
  )
  return await executePreparedCommands({
    account,
    commands,
    disclosedContracts,
    method: 'amulet.preapproval.cancel',
    summary: 'Disable Amulet auto-accept',
    signMessage,
    recordTransaction,
  })
}
