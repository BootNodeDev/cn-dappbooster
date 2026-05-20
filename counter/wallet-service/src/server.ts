import 'dotenv/config'

import { SDK } from '@canton-network/wallet-sdk'
import cors from 'cors'
import express from 'express'
import { loadConfig } from './config.js'
import { createMockHandler, isMockEnabled } from './mock.js'

const config = loadConfig()
const mockEnabled = isMockEnabled()
const mockHandler = mockEnabled ? createMockHandler(config) : undefined
const app = express()

app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))

type JsonRpcId = string | number | null
type JsonRpcRequest = {
  jsonrpc?: '2.0'
  id?: JsonRpcId
  method?: unknown
  params?: unknown
}

type JsonRpcResult = {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

type JsonRpcError = {
  jsonrpc: '2.0'
  id: JsonRpcId
  error: {
    code: number
    message: string
    data?: unknown
  }
}

type RpcResponse = JsonRpcResult | JsonRpcError

type WalletSdk = Awaited<ReturnType<typeof SDK.create>>

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

const rpcResult = (id: JsonRpcId, result: unknown): JsonRpcResult => ({ jsonrpc: '2.0', id, result })

const rpcError = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data }
})

const unsupported = (id: JsonRpcId, method: string): JsonRpcError =>
  rpcError(id, -32004, 'Method not supported', {
    method,
    reason: 'This wallet-service has no private keys. Use Carpincho over WalletConnect for dApp-facing signing methods.'
  })

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const errorData = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { raw: String(error) }
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause
  }
}

let sdkPromise: Promise<WalletSdk> | undefined
const pendingPartyCreations = new Map<string, PreparedExternalPartyCreation>()

const getSdk = async (): Promise<WalletSdk> => {
  if (config.canton.backendToken === undefined) {
    throw new Error('CANTON_BACKEND_TOKEN is required for Canton JSON API calls')
  }
  sdkPromise ??= SDK.create({
      auth: { method: 'static', token: config.canton.backendToken },
      ledgerClientUrl: config.canton.jsonApiUrl,
      logAdapter: 'console'
    })
    .catch((error: unknown) => {
      sdkPromise = undefined
      throw new Error('Canton wallet SDK failed to initialize', { cause: error })
    })
  return await sdkPromise
}

const objectParam = <T>(params: unknown, name: string): T => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new Error(`${name} params must be an object`)
  }
  return params as T
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

const ledgerJsonApiVersion = async (): Promise<{ connected: boolean; reason?: string }> => {
  try {
    const response = await fetch(`${config.canton.jsonApiUrl.replace(/\/$/, '')}/v2/version`, {
      signal: AbortSignal.timeout(1000)
    })
    return response.ok
      ? { connected: true }
      : { connected: false, reason: `Ledger API returned HTTP ${response.status}` }
  } catch (error) {
    return { connected: false, reason: (error as Error).message }
  }
}

const connectResult = async (): Promise<Record<string, unknown>> => {
  const network = await ledgerJsonApiVersion()
  return {
    isConnected: false,
    reason: 'No wallet session/account implementation yet.',
    isNetworkConnected: network.connected,
    ...(network.reason === undefined ? {} : { networkReason: network.reason }),
    ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl })
  }
}

const network = (): Record<string, unknown> => ({
  networkId: config.network
})

const provider = (): Record<string, unknown> => ({
  id: config.provider.id,
  version: config.provider.version,
  providerType: 'remote',
  ...(config.provider.url === undefined ? {} : { url: config.provider.url }),
  ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl })
})

const handleRpc = async (request: JsonRpcRequest): Promise<RpcResponse> => {
  const id = request.id ?? null
  if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
    return rpcError(id, -32600, 'Invalid request', { reason: 'jsonrpc must be "2.0"' })
  }
  if (typeof request.method !== 'string') {
    return rpcError(id, -32600, 'Invalid request', { reason: 'method must be a string' })
  }

  if (mockHandler !== undefined) {
    const response = mockHandler({ method: request.method, params: request.params, id })
    return response.ok
      ? rpcResult(id, response.result)
      : rpcError(id, response.error.code, response.error.message, response.error.data)
  }

  switch (request.method) {
    case 'status': {
      const connection = await connectResult()
      return rpcResult(id, { provider: provider(), connection, network: network() })
    }
    case 'connect':
    case 'isConnected':
      return rpcResult(id, await connectResult())
    case 'disconnect':
      return rpcResult(id, null)
    case 'getActiveNetwork':
      return rpcResult(id, network())
    case 'listAccounts':
      return rpcResult(id, [])
    case 'getPrimaryAccount':
      return rpcError(id, -32001, 'Resource not found', { reason: 'No primary account configured yet.' })
    case 'prepareTransaction':
      return rpcResult(id, await prepareTransaction(request.params))
    case 'executePrepared':
      return rpcResult(id, await executePrepared(request.params))
    case 'ledgerApi':
      return rpcResult(id, await ledgerApi(request.params))
    case 'prepareCreateParty':
      return rpcResult(id, await prepareCreateParty(request.params))
    case 'completeCreateParty':
      return rpcResult(id, await completeCreateParty(request.params))
    case 'prepareExecute':
    case 'prepareExecuteAndWait':
    case 'signMessage':
      return unsupported(id, request.method)
    default:
      return rpcError(id, -32601, 'Method not found', { method: request.method })
  }
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'counter-wallet-service', network: config.network, mock: mockEnabled })
})

const serviceInfo = (): Record<string, unknown> => ({
    service: 'counter-wallet-service',
    rpcEndpoint: '/rpc',
    api: 'Carpincho service bridge over JSON-RPC 2.0',
    dappApi: 'CIP-0103 is exposed by Carpincho over WalletConnect; this service has no signer.',
    supportedMethods: [
      'status',
      'connect',
      'disconnect',
      'isConnected',
      'getActiveNetwork',
      'listAccounts',
      'getPrimaryAccount',
      'ledgerApi',
      'prepareTransaction',
      'executePrepared',
      'prepareCreateParty',
      'completeCreateParty'
    ],
    reservedMethods: ['prepareExecute', 'prepareExecuteAndWait', 'signMessage'],
    network: config.network,
    provider: provider(),
    canton: {
      jsonApiUrl: config.canton.jsonApiUrl,
      ledgerApiUrl: config.canton.ledgerApiUrl,
      adminApiUrl: config.canton.adminApiUrl,
      backendUserId: config.canton.backendUserId,
      hasBackendToken: config.canton.backendToken !== undefined
    },
    mock: mockEnabled
})

app.get('/', (_req, res) => {
  res.json(serviceInfo())
})

app.get('/wallet-service/info', (_req, res) => {
  res.json(serviceInfo())
})

app.post('/rpc', async (req, res) => {
  const body = req.body as unknown
  const id = typeof body === 'object' && body !== null && !Array.isArray(body)
    ? ((body as JsonRpcRequest).id ?? null)
    : null
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    res.json(rpcError(null, -32600, 'Invalid request', { reason: 'JSON-RPC body must be an object' }))
    return
  }
  try {
    res.json(await handleRpc(body as JsonRpcRequest))
  } catch (error) {
    console.error('[counter-wallet-service] rpc failed', {
      id,
      method: (body as JsonRpcRequest).method,
      error: errorData(error)
    })
    res.json(rpcError(id, -32000, errorMessage(error), errorData(error)))
  }
})

app.listen(config.port, () => {
  console.log(`counter-wallet-service listening on ${config.port}${mockEnabled ? ' (MOCK MODE — no Canton calls)' : ''}`)
})
