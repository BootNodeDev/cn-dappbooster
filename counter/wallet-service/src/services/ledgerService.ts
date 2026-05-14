import { objectParam } from './params.js'
import type { WalletSdkService } from './walletSdk.js'

type PrepareTransactionParams = {
  partyId?: string
  commandId?: string
  commands?: unknown
  actAs?: string[]
  readAs?: string[]
  synchronizerId?: string
  disclosedContracts?: unknown[]
}

type ExecutePreparedParams = {
  partyId?: string
  preparedTransaction?: string
  preparedTransactionHash?: string
  hashingSchemeVersion?: 'HASHING_SCHEME_VERSION_UNSPECIFIED' | 'HASHING_SCHEME_VERSION_V2' | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
  signatureBase64?: string
  submissionId?: string
}

type LedgerApiParams = {
  requestMethod?: string
  resource?: string
  body?: {
    parties?: string[]
    templateIds?: string[]
    filterByParty?: boolean
    offset?: number
    limit?: number
  }
}

const firstParty = (params: PrepareTransactionParams | ExecutePreparedParams): string => {
  if (typeof params.partyId === 'string' && params.partyId.length > 0) {
    return params.partyId
  }
  if ('actAs' in params && Array.isArray(params.actAs) && params.actAs[0] !== undefined) {
    return params.actAs[0]
  }
  throw new Error('partyId or actAs[0] is required')
}

export const createLedgerService = ({ getSdk }: WalletSdkService) => {
  const prepareTransaction = async (params: unknown): Promise<unknown> => {
    const p = objectParam<PrepareTransactionParams>(params, 'prepareTransaction')
    const partyId = firstParty(p)
    if (p.commands === undefined) {
      throw new Error('commands is required')
    }
    const sdk = await getSdk()
    const prepared = sdk.ledger.prepare({
      partyId,
      commands: p.commands,
      commandId: p.commandId,
      synchronizerId: p.synchronizerId,
      disclosedContracts: p.disclosedContracts as never
    })
    const json = await prepared.toJSON()
    return json.response
  }

  const executePrepared = async (params: unknown): Promise<unknown> => {
    const p = objectParam<ExecutePreparedParams>(params, 'executePrepared')
    const partyId = firstParty(p)
    if (p.preparedTransaction === undefined || p.preparedTransactionHash === undefined || p.hashingSchemeVersion === undefined) {
      throw new Error('preparedTransaction, preparedTransactionHash and hashingSchemeVersion are required')
    }
    if (p.signatureBase64 === undefined || p.signatureBase64.length === 0) {
      throw new Error('signatureBase64 is required')
    }
    const sdk = await getSdk()
    const response = {
      preparedTransaction: p.preparedTransaction,
      preparedTransactionHash: p.preparedTransactionHash,
      hashingSchemeVersion: p.hashingSchemeVersion,
      ...(p.hashingDetails === undefined ? {} : { hashingDetails: p.hashingDetails }),
      ...(p.costEstimation === undefined ? {} : { costEstimation: p.costEstimation as never })
    }
    const signed = sdk.ledger.fromSignature(response, p.signatureBase64)
    return await sdk.ledger.execute(signed, {
      partyId,
      submissionId: p.submissionId
    })
  }

  const ledgerApi = async (params: unknown): Promise<unknown> => {
    const p = objectParam<LedgerApiParams>(params, 'ledgerApi')
    if (p.requestMethod !== 'post' || p.resource !== '/v2/state/active-contracts') {
      throw new Error('Only POST /v2/state/active-contracts is implemented in this scaffold')
    }
    const parties = p.body?.parties
    if (!Array.isArray(parties) || parties.length === 0) {
      throw new Error('body.parties is required')
    }
    const sdk = await getSdk()
    const contracts = await sdk.ledger.acs.read({
      parties,
      templateIds: p.body?.templateIds,
      filterByParty: p.body?.filterByParty ?? true,
      offset: p.body?.offset,
      limit: p.body?.limit
    })
    return { contracts }
  }

  return { prepareTransaction, executePrepared, ledgerApi }
}

export type LedgerService = ReturnType<typeof createLedgerService>
