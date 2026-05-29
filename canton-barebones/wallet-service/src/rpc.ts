import { SDK } from '@canton-network/wallet-sdk'
import type { WalletServiceConfig } from './config.ts'
import type {
  ConnectResult,
  JsonRpcError,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  JsPrepareSubmissionRequest,
  LedgerApiRequest,
  Network,
  Provider,
  StatusEvent,
} from './types.ts'

export class InvalidParams extends Error {
  readonly code = -32602
  constructor(message: string) {
    super(message)
    this.name = 'InvalidParams'
  }
}

export type PendingStore<T> = {
  set: (id: string, value: T) => void
  get: (id: string) => T | undefined
  delete: (id: string) => void
  size: () => number
}

type PendingStoreOptions = {
  ttlMs: number
  maxSize: number
  now?: () => number
}

export const createPendingStore = <T>(opts: PendingStoreOptions): PendingStore<T> => {
  const now = opts.now ?? (() => Date.now())
  const entries = new Map<string, { value: T; expiresAt: number }>()

  const evictExpired = (): void => {
    const current = now()
    for (const [key, entry] of entries) {
      if (entry.expiresAt <= current) {
        entries.delete(key)
      }
    }
  }

  const evictOverflow = (): void => {
    while (entries.size > opts.maxSize) {
      const oldest = entries.keys().next().value
      if (oldest === undefined) {
        break
      }
      entries.delete(oldest)
    }
  }

  return {
    set: (id, value) => {
      evictExpired()
      entries.set(id, { value, expiresAt: now() + opts.ttlMs })
      evictOverflow()
    },
    get: (id) => {
      const entry = entries.get(id)
      if (entry === undefined) {
        return undefined
      }
      if (entry.expiresAt <= now()) {
        entries.delete(id)
        return undefined
      }
      return entry.value
    },
    delete: (id) => {
      entries.delete(id)
    },
    // upper bound: expired-but-unaccessed entries are counted until the next set() eviction
    size: () => entries.size,
  }
}

export type WalletSdk = Awaited<ReturnType<typeof SDK.create>>

type ExecutePreparedParams = {
  partyId?: string
  actAs?: string[]
  preparedTransaction?: string
  preparedTransactionHash?: string
  hashingSchemeVersion?:
    | 'HASHING_SCHEME_VERSION_UNSPECIFIED'
    | 'HASHING_SCHEME_VERSION_V2'
    | 'HASHING_SCHEME_VERSION_V3'
  hashingDetails?: string
  costEstimation?: unknown
  signatureBase64?: string
  submissionId?: string
}

export const rpcResult = (id: JsonRpcId, result: unknown): JsonRpcSuccess => ({
  jsonrpc: '2.0',
  id,
  result,
})

export const rpcError = (
  id: JsonRpcId,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data },
})

const unsupported = (id: JsonRpcId, method: string): JsonRpcError =>
  rpcError(id, -32004, 'Method not supported', {
    method,
    reason: 'This wallet-service has no private keys. Carpincho signs.',
  })

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

const errorData = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { raw: String(error) }
  }
  const base: Record<string, unknown> = { name: error.name, message: error.message }
  if (process.env.NODE_ENV !== 'production') {
    base.stack = error.stack
    base.cause = error.cause
  }
  return base
}

export const objectParam = <T>(params: unknown, name: string): T => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new InvalidParams(`${name} params must be an object`)
  }
  return params as T
}

export const buildProvider = (p: WalletServiceConfig['provider']): Provider => ({
  id: p.id,
  clientType: 'remote',
  version: p.version,
  providerType: 'remote',
  ...(p.url === undefined ? {} : { url: p.url }),
  ...(p.userUrl === undefined ? {} : { userUrl: p.userUrl }),
})

const firstParty = (params: { partyId?: string; actAs?: string[] }): string => {
  if (typeof params.partyId === 'string' && params.partyId.length > 0) {
    return params.partyId
  }
  if (Array.isArray(params.actAs) && typeof params.actAs[0] === 'string') {
    return params.actAs[0]
  }
  throw new InvalidParams('partyId or actAs[0] is required')
}

export type Rpc = {
  handle: (request: JsonRpcRequest) => Promise<JsonRpcResponse | undefined>
  serviceInfo: () => Record<string, unknown>
  getSdk: () => Promise<WalletSdk>
}

export const createRpc = (config: WalletServiceConfig): Rpc => {
  let sdkPromise: Promise<WalletSdk> | undefined

  const getSdk = async (): Promise<WalletSdk> => {
    if (config.canton.backendToken === undefined) {
      throw new Error('CANTON_BACKEND_TOKEN is required for Canton JSON API calls')
    }
    sdkPromise ??= SDK.create({
      auth: { method: 'static', token: config.canton.backendToken },
      ledgerClientUrl: config.canton.jsonApiUrl,
      logAdapter: 'console',
    }).catch((cause: unknown) => {
      sdkPromise = undefined
      throw new Error('Canton wallet SDK failed to initialize', { cause })
    })
    return await sdkPromise
  }

  const ledgerJsonApiVersion = async (): Promise<{ connected: boolean; reason?: string }> => {
    try {
      const response = await fetch(`${config.canton.jsonApiUrl.replace(/\/$/, '')}/v2/version`, {
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
        ? { connected: true }
        : { connected: false, reason: `Ledger API returned HTTP ${response.status}` }
    } catch (error) {
      return { connected: false, reason: (error as Error).message }
    }
  }

  const connectResult = async (): Promise<ConnectResult> => {
    const networkStatus = await ledgerJsonApiVersion()
    return {
      isConnected: false,
      reason: 'No wallet session/account implementation yet.',
      isNetworkConnected: networkStatus.connected,
      ...(networkStatus.reason === undefined ? {} : { networkReason: networkStatus.reason }),
      ...(config.provider.userUrl === undefined ? {} : { userUrl: config.provider.userUrl }),
    }
  }

  const network = (): Network => ({ networkId: config.network })

  const provider = (): Provider => buildProvider(config.provider)

  const status = async (): Promise<StatusEvent> => ({
    provider: provider(),
    connection: await connectResult(),
    network: network(),
  })

  const prepareTransaction = async (params: unknown): Promise<unknown> => {
    const p = objectParam<JsPrepareSubmissionRequest & { partyId?: string }>(
      params,
      'prepareTransaction',
    )
    const partyId = firstParty(p)
    if (p.commands === undefined) {
      throw new InvalidParams('commands is required')
    }
    const sdk = await getSdk()
    const prepared = sdk.ledger.prepare({
      partyId,
      commands: p.commands,
      commandId: p.commandId,
      synchronizerId: p.synchronizerId,
      // SDK accepts the spec's DisclosedContract shape; cast preserved across SDK type drift.
      disclosedContracts: p.disclosedContracts as never,
    })
    const json = await prepared.toJSON()
    return json.response
  }

  const executePrepared = async (params: unknown): Promise<unknown> => {
    const p = objectParam<ExecutePreparedParams>(params, 'executePrepared')
    const partyId = firstParty(p)
    const missing = (
      ['preparedTransaction', 'preparedTransactionHash', 'hashingSchemeVersion'] as const
    ).filter((key) => p[key] === undefined)
    if (missing.length > 0) {
      throw new InvalidParams(`missing required fields: ${missing.join(', ')}`)
    }
    if (p.signatureBase64 === undefined || p.signatureBase64.length === 0) {
      throw new InvalidParams('signatureBase64 is required')
    }
    const sdk = await getSdk()
    // non-null assertions are safe: missing.length > 0 guard above throws for any undefined field
    const response = {
      preparedTransaction: p.preparedTransaction!,
      preparedTransactionHash: p.preparedTransactionHash!,
      hashingSchemeVersion: p.hashingSchemeVersion!,
      ...(p.hashingDetails === undefined ? {} : { hashingDetails: p.hashingDetails }),
      ...(p.costEstimation === undefined ? {} : { costEstimation: p.costEstimation as never }),
    }
    const signed = sdk.ledger.fromSignature(response, p.signatureBase64)
    return await sdk.ledger.execute(signed, { partyId, submissionId: p.submissionId })
  }

  const safeJsonParse = (text: string): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  // Transparent proxy to the participant's JSON API. Matches the canonical
  // `@canton-network/wallet-gateway-remote` behavior: forwards `body` opaquely,
  // returns the raw parsed body on 2xx, throws on non-2xx (mapped to -32000 by
  // the dispatch catch). dApps are responsible for sending participant-native
  // payloads; see core-ledger-client `PostEndpoint`/`PostRequest<T>` typings
  // for the per-endpoint shapes.
  const ledgerApi = async (params: unknown): Promise<unknown> => {
    const p = objectParam<LedgerApiRequest>(params, 'ledgerApi')
    if (typeof p.resource !== 'string' || p.resource.length === 0) {
      throw new InvalidParams('resource is required')
    }
    if (typeof p.requestMethod !== 'string' || p.requestMethod.length === 0) {
      throw new InvalidParams('requestMethod is required')
    }
    const method = p.requestMethod.toUpperCase()
    if (config.canton.backendToken === undefined) {
      throw new Error('CANTON_BACKEND_TOKEN is required for Canton JSON API calls')
    }
    const url = new URL(p.resource, config.canton.jsonApiUrl)
    for (const [key, value] of Object.entries(p.query ?? {})) {
      url.searchParams.set(key, String(value))
    }
    const init: RequestInit = {
      method,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.canton.backendToken}`,
      },
      signal: AbortSignal.timeout(15_000),
    }
    if (method !== 'GET' && method !== 'HEAD' && p.body !== undefined) {
      init.body = JSON.stringify(p.body)
    }
    const response = await fetch(url, init)
    const text = await response.text()
    const isJson =
      text.length > 0 && response.headers.get('content-type')?.includes('json') === true
    const parsed: unknown = isJson ? safeJsonParse(text) : text
    if (!response.ok) {
      const detail = typeof parsed === 'string' ? parsed : JSON.stringify(parsed)
      throw new Error(
        `Canton JSON API ${method} ${p.resource} → HTTP ${response.status}: ${detail}`,
      )
    }
    return parsed
  }

  const dispatch = async (id: JsonRpcId, request: JsonRpcRequest): Promise<JsonRpcResponse> => {
    if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'jsonrpc must be "2.0"' })
    }
    if (typeof request.method !== 'string') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'method must be a string' })
    }
    try {
      switch (request.method) {
        case 'status':
          return rpcResult(id, await status())
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
          return rpcError(id, -32001, 'Resource not found', {
            reason: 'No primary account configured yet.',
          })
        case 'prepareTransaction':
          return rpcResult(id, await prepareTransaction(request.params))
        case 'executePrepared':
          return rpcResult(id, await executePrepared(request.params))
        case 'ledgerApi':
          return rpcResult(id, await ledgerApi(request.params))
        case 'prepareExecute':
        case 'prepareExecuteAndWait':
        case 'signMessage':
          return unsupported(id, request.method)
        default:
          return rpcError(id, -32601, 'Method not found', { method: request.method })
      }
    } catch (error) {
      console.error('[wallet-service] rpc failed', {
        id,
        method: request.method,
        error: errorData(error),
      })
      if (error instanceof InvalidParams) {
        return rpcError(id, -32602, error.message, { method: request.method })
      }
      return rpcError(id, -32000, errorMessage(error), errorData(error))
    }
  }

  const handle = async (request: JsonRpcRequest): Promise<JsonRpcResponse | undefined> => {
    const isNotification = !('id' in request)
    const id = request.id ?? null
    const response = await dispatch(id, request)
    return isNotification ? undefined : response
  }

  const serviceInfo = (): Record<string, unknown> => ({
    service: 'wallet-service',
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
    ],
    reservedMethods: ['prepareExecute', 'prepareExecuteAndWait', 'signMessage'],
    adminEndpoints: ['POST /admin/party/prepare', 'POST /admin/party/complete'],
    network: config.network,
    provider: provider(),
    canton: {
      jsonApiUrl: config.canton.jsonApiUrl,
      ledgerApiUrl: config.canton.ledgerApiUrl,
      adminApiUrl: config.canton.adminApiUrl,
      backendUserId: config.canton.backendUserId,
      hasBackendToken: config.canton.backendToken !== undefined,
    },
  })

  return { handle, serviceInfo, getSdk }
}
