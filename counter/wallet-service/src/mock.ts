import crypto from 'node:crypto'
import type { WalletServiceConfig } from './config.js'

export interface MockRpcRequest {
  method: string
  params?: unknown
  id?: string | number | null
}

export interface MockRpcResult {
  ok: true
  result: unknown
}

export interface MockRpcError {
  ok: false
  error: { code: number; message: string; data?: unknown }
}

export type MockRpcResponse = MockRpcResult | MockRpcError

interface MockState {
  parties: Map<string, { partyId: string }>
  offset: number
}

const newState = (): MockState => ({ parties: new Map(), offset: 0 })

const ok = (result: unknown): MockRpcResponse => ({ ok: true, result })
const rpcErr = (code: number, message: string, data?: unknown): MockRpcResponse => ({
  ok: false,
  error: data === undefined ? { code, message } : { code, message, data }
})

const objectParam = (params: unknown, name: string): Record<string, unknown> => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new Error(`${name} params must be an object`)
  }
  return params as Record<string, unknown>
}

const randomBase64 = (bytes: number): string => crypto.randomBytes(bytes).toString('base64')

const slugify = (value: string): string => value.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 32) || 'mock'

export const createMockHandler = (config: WalletServiceConfig): ((request: MockRpcRequest) => MockRpcResponse) => {
  const state = newState()
  const networkId = `${config.network}-mock`

  const provider = (): Record<string, unknown> => ({
    id: config.provider.id,
    version: config.provider.version,
    providerType: 'remote',
    ...(config.provider.url === undefined ? {} : { url: config.provider.url }),
    ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl })
  })

  const network = (): Record<string, unknown> => ({ networkId })

  const connection = (): Record<string, unknown> => ({
    isConnected: false,
    reason: 'wallet-service mock: no real Canton participant attached.',
    isNetworkConnected: true,
    networkReason: 'mock backend always reports ready'
  })

  const prepareCreateParty = (params: unknown): unknown => {
    const p = objectParam(params, 'prepareCreateParty')
    const publicKeyBase64 = typeof p.publicKeyBase64 === 'string' ? p.publicKeyBase64 : undefined
    if (publicKeyBase64 === undefined || publicKeyBase64.trim() === '') {
      throw new Error('publicKeyBase64 is required')
    }
    const partyHint = typeof p.partyHint === 'string' ? p.partyHint.trim() : ''
    const onboardingId = crypto.randomUUID()
    const partyId = `${slugify(partyHint === '' ? 'mock' : partyHint)}::mock-${crypto.randomBytes(6).toString('hex')}`
    state.parties.set(onboardingId, { partyId })
    return {
      onboardingId,
      partyId,
      multiHash: randomBase64(32),
      topologyTransactions: []
    }
  }

  const completeCreateParty = (params: unknown): unknown => {
    const p = objectParam(params, 'completeCreateParty')
    const onboardingId = typeof p.onboardingId === 'string' ? p.onboardingId : ''
    const signatureBase64 = typeof p.signatureBase64 === 'string' ? p.signatureBase64 : ''
    if (onboardingId === '') {
      throw new Error('onboardingId is required')
    }
    if (signatureBase64 === '') {
      throw new Error('signatureBase64 is required')
    }
    const entry = state.parties.get(onboardingId)
    if (entry === undefined) {
      throw new Error('party onboarding request not found or expired')
    }
    state.parties.delete(onboardingId)
    return { partyId: entry.partyId }
  }

  const pickPartyId = (p: Record<string, unknown>): string | undefined => {
    if (typeof p.partyId === 'string' && p.partyId.length > 0) {
      return p.partyId
    }
    if (Array.isArray(p.actAs) && typeof p.actAs[0] === 'string' && p.actAs[0].length > 0) {
      return p.actAs[0]
    }
    return undefined
  }

  const prepareTransaction = (params: unknown): unknown => {
    const p = objectParam(params, 'prepareTransaction')
    const partyId = pickPartyId(p)
    if (partyId === undefined) {
      throw new Error('partyId or actAs[0] is required')
    }
    if (p.commands === undefined) {
      throw new Error('commands is required')
    }
    return {
      preparedTransaction: randomBase64(64),
      preparedTransactionHash: randomBase64(32),
      hashingSchemeVersion: 'HASHING_SCHEME_VERSION_V2'
    }
  }

  const executePrepared = (params: unknown): unknown => {
    const p = objectParam(params, 'executePrepared')
    if (typeof p.preparedTransaction !== 'string' || typeof p.preparedTransactionHash !== 'string') {
      throw new Error('preparedTransaction and preparedTransactionHash are required')
    }
    if (typeof p.signatureBase64 !== 'string' || p.signatureBase64.length === 0) {
      throw new Error('signatureBase64 is required')
    }
    state.offset += 1
    return {
      updateId: `mock-update-${crypto.randomBytes(6).toString('hex')}`,
      completionOffset: state.offset
    }
  }

  const ledgerApi = (params: unknown): unknown => {
    const p = objectParam(params, 'ledgerApi')
    if (p.requestMethod !== 'post' || p.resource !== '/v2/state/active-contracts') {
      throw new Error('Only POST /v2/state/active-contracts is implemented in this mock')
    }
    return { contracts: [] }
  }

  return (request: MockRpcRequest): MockRpcResponse => {
    try {
      switch (request.method) {
        case 'status':
          return ok({ provider: provider(), connection: connection(), network: network() })
        case 'connect':
        case 'isConnected':
          return ok(connection())
        case 'disconnect':
          return ok(null)
        case 'getActiveNetwork':
          return ok(network())
        case 'listAccounts':
          return ok([])
        case 'getPrimaryAccount':
          return rpcErr(-32001, 'Resource not found', { reason: 'mock has no primary account configured.' })
        case 'prepareCreateParty':
          return ok(prepareCreateParty(request.params))
        case 'completeCreateParty':
          return ok(completeCreateParty(request.params))
        case 'prepareTransaction':
          return ok(prepareTransaction(request.params))
        case 'executePrepared':
          return ok(executePrepared(request.params))
        case 'ledgerApi':
          return ok(ledgerApi(request.params))
        case 'prepareExecute':
        case 'prepareExecuteAndWait':
        case 'signMessage':
          return rpcErr(-32004, 'Method not supported', {
            method: request.method,
            reason: 'mock has no signer; use Carpincho over WalletConnect for these methods.'
          })
        default:
          return rpcErr(-32601, 'Method not found', { method: request.method })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return rpcErr(-32000, message)
    }
  }
}

export const isMockEnabled = (): boolean => {
  const value = process.env.WALLET_SERVICE_MOCK
  if (value === undefined) {
    return false
  }
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}
