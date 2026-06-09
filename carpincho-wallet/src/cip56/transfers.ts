import { executePreparedCommands } from '@/api/interactiveSubmission'
import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface TokenInstrumentId {
  admin?: string
  id?: string
}

export interface PendingTokenTransfer {
  contractId: string
  interfaceViewValue?: {
    transfer?: {
      sender?: string
      receiver?: string
      amount?: string
      instrumentId?: TokenInstrumentId
    }
    status?: {
      current?: {
        tag?: string
      } | null
    }
  }
}

interface AcceptTransferCommands {
  commands: unknown
  disclosedContracts?: unknown[]
}

interface AcceptTransferParams {
  account: AccountPublic
  transferInstructionCid: string
  signMessage: VaultContextValue['signMessage']
  recordTransaction: VaultContextValue['recordTransaction']
}

// Keeps token labels readable while preserving the SDK contract payload shape elsewhere.
export const tokenDisplayLabel = (instrumentId?: TokenInstrumentId): string =>
  instrumentId?.id?.trim() === undefined || instrumentId.id.trim() === ''
    ? 'unknown token'
    : instrumentId.id.trim()

// Reads pending transfer contracts through wallet-service, which owns the Node-only SDK dependency.
export const listPendingIncomingTransfers = async (
  partyId: string,
): Promise<PendingTokenTransfer[]> =>
  await walletServiceRequest<PendingTokenTransfer[]>('cip56.listPendingTransfers', { partyId })

// Accepts a transfer using wallet-service SDK commands and Carpincho's local signer.
export const acceptPendingTransfer = async ({
  account,
  transferInstructionCid,
  signMessage,
  recordTransaction,
}: AcceptTransferParams): Promise<{ updateId?: string; completionOffset?: number }> => {
  const { commands, disclosedContracts } = await walletServiceRequest<AcceptTransferCommands>(
    'cip56.acceptTransfer',
    { transferInstructionCid },
  )
  return await executePreparedCommands({
    account,
    commands,
    disclosedContracts,
    method: 'cip56.transfer.accept',
    summary: 'Accept transfer',
    signMessage,
    recordTransaction,
  })
}
