import { executePreparedCommands } from '@/api/interactiveSubmission'
import { walletServiceRequest } from '@/api/walletService'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface TokenInstrumentId {
  admin?: string
  id?: string
}

interface TransferMetadata {
  values?: Record<string, unknown>
}

export interface PendingTokenTransfer {
  contractId: string
  interfaceViewValue?: {
    transfer?: {
      sender?: string
      receiver?: string
      amount?: string
      instrumentId?: TokenInstrumentId
      requestedAt?: string
      executeBefore?: string
      meta?: TransferMetadata
    }
    status?: {
      tag?: string
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

const TRANSFER_REASON_KEY = 'splice.lfdecentralizedtrust.org/reason'

// Keeps token labels readable while preserving the SDK contract payload shape elsewhere.
export const tokenDisplayLabel = (instrumentId?: TokenInstrumentId): string =>
  instrumentId?.id?.trim() === undefined || instrumentId.id.trim() === ''
    ? 'unknown token'
    : instrumentId.id.trim()

// Extracts the Amulet sender description from the CIP-56 transfer metadata.
export const transferDescription = (transfer: PendingTokenTransfer): string | undefined => {
  const value = transfer.interfaceViewValue?.transfer?.meta?.values?.[TRANSFER_REASON_KEY]
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

// Reads the current transfer status across SDK payload variants.
export const transferStatusLabel = (transfer: PendingTokenTransfer): string =>
  transfer.interfaceViewValue?.status?.tag ??
  transfer.interfaceViewValue?.status?.current?.tag ??
  'unknown'

// Formats transfer timestamps in a deterministic UTC label for compact wallet details.
export const transferTimeLabel = (value?: string): string => {
  if (value === undefined || value.trim() === '') {
    return 'unknown'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  const yyyy = String(date.getUTCFullYear()).padStart(4, '0')
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(date.getUTCDate()).padStart(2, '0')
  const hh = String(date.getUTCHours()).padStart(2, '0')
  const min = String(date.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`
}

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
