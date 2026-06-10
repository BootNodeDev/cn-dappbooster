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

type SdkFactory = (options: unknown) => Promise<unknown>

type RpcDependencies = {
  sdkFactory?: SdkFactory
  fetch?: typeof fetch
  now?: () => Date
}

type Cip56TokenSdk = {
  amulet?: {
    preapproval: {
      command: {
        create: (args: { parties: { receiver: string } }) => Promise<unknown>
        cancel: (args: { parties: { receiver: string } }) => Promise<[unknown, unknown[]]>
      }
      fetchStatus: (receiver: string) => Promise<{
        contractId: string
        templateId: string
        expiresAt: Date | string
      } | null>
    }
  }
  token: {
    transfer: {
      pending: (partyId: string) => Promise<unknown>
      accept: (params: {
        transferInstructionCid: string
        registryUrl: URL
      }) => Promise<[unknown, unknown[]]>
      create: (params: {
        sender: string
        recipient: string
        amount: string
        instrumentId: string
        registryUrl: URL
        memo?: string
        expirationDate?: Date
      }) => Promise<[unknown, unknown[]]>
    }
    utxos: {
      list: (params: {
        partyId: string
        includeLocked: boolean
        limit: number
        continueUntilCompletion: boolean
      }) => Promise<unknown>
    }
  }
}

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

type TokenInstrumentId = {
  admin?: string
  id?: string
}

type TokenHolding = {
  contractId: string
  interfaceViewValue?: {
    amount?: string
    instrumentId?: TokenInstrumentId
    lock?: unknown
  }
}

type TokenHoldingSummary = {
  key: string
  tokenLabel: string
  instrumentId?: TokenInstrumentId
  totalAmount: string
  utxoCount?: number
  lockedCount?: number
  unlockedCount?: number
  holdings?: TokenHolding[]
  source: 'scan' | 'utxos'
  scan?: {
    totalUnlockedCoin: string
    totalLockedCoin: string
    totalCoinHoldings: string
    accumulatedHoldingFeesUnlocked: string
    accumulatedHoldingFeesLocked: string
    accumulatedHoldingFeesTotal: string
    totalAvailableCoin: string
  }
}

type AmuletPreapprovalStatus = {
  active: boolean
  expired: boolean
  contractId?: string
  templateId?: string
  expiresAt?: string
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

// SDK rejections are plain JsCantonError objects ({ code, cause, ... }), not
// Error instances — String() would collapse them to "[object Object]".
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (isPlainObject(error)) {
    if (typeof error.code === 'string' && typeof error.cause === 'string') {
      return `${error.code}: ${error.cause}`
    }
    try {
      return JSON.stringify(error)
    } catch {
      return String(error)
    }
  }
  return String(error)
}

export const errorData = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    const base: Record<string, unknown> = { name: error.name, message: error.message }
    if (process.env.NODE_ENV !== 'production') {
      base.stack = error.stack
      base.cause = error.cause
    }
    return base
  }
  if (isPlainObject(error)) {
    return error
  }
  return { raw: String(error) }
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

const requiredStringParam = (params: Record<string, unknown>, name: string): string => {
  const value = params[name]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidParams(`${name} is required`)
  }
  return value
}

// Converts an optional ISO timestamp into the Date shape expected by wallet-sdk transfer helpers.
const optionalDateParam = (params: Record<string, unknown>, name: string): Date | undefined => {
  const value = params[name]
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new InvalidParams(`${name} must be an ISO timestamp`)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new InvalidParams(`${name} must be an ISO timestamp`)
  }
  return date
}

// Reads the optional token instrument selector from JSON-RPC params.
const optionalInstrumentParam = (p: Record<string, unknown>): TokenInstrumentId | undefined => {
  const value = p.instrumentId
  if (value === undefined) {
    return undefined
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InvalidParams('instrumentId must be an object')
  }
  const record = value as Record<string, unknown>
  const admin = record.admin
  const id = record.id
  if (admin !== undefined && typeof admin !== 'string') {
    throw new InvalidParams('instrumentId.admin must be a string')
  }
  if (id !== undefined && typeof id !== 'string') {
    throw new InvalidParams('instrumentId.id must be a string')
  }
  return {
    ...(admin === undefined || admin.trim() === '' ? {} : { admin: admin.trim() }),
    ...(id === undefined || id.trim() === '' ? {} : { id: id.trim() }),
  }
}

// Identifies CC/Amulet requests, the only token family Scan can summarize.
const isAmuletInstrument = (instrumentId?: TokenInstrumentId): boolean =>
  instrumentId === undefined ||
  instrumentId.id === undefined ||
  ['amulet', 'amt', 'cantoncoin', 'canton coin', 'cc'].includes(
    instrumentId.id.trim().toLowerCase(),
  )

// Creates the same grouping key Carpincho uses for token rows.
const instrumentKey = (instrumentId?: TokenInstrumentId): string =>
  `${instrumentId?.admin ?? 'unknown-admin'}:${instrumentId?.id ?? 'unknown-token'}`

// Keeps token labels readable in summary rows.
const instrumentLabel = (instrumentId?: TokenInstrumentId): string => {
  const id = instrumentId?.id?.trim()
  return id === undefined || id === '' ? 'unknown token' : id
}

// Parses positive decimal strings without floating point rounding.
const parseDecimalAmount = (value: string): { scaled: bigint; scale: number } | undefined => {
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return undefined
  }
  const [whole, fraction = ''] = trimmed.split('.')
  return {
    scaled: BigInt(`${whole}${fraction}`),
    scale: fraction.length,
  }
}

// Adds SDK decimal amount strings exactly enough for token balance display.
const sumDecimalAmounts = (values: string[]): string => {
  const parsed = values
    .map(parseDecimalAmount)
    .filter((value): value is { scaled: bigint; scale: number } => value !== undefined)
  if (parsed.length === 0) {
    return '0'
  }
  const scale = Math.max(...parsed.map((value) => value.scale))
  const total = parsed.reduce((acc, value) => {
    const multiplier = 10n ** BigInt(scale - value.scale)
    return acc + value.scaled * multiplier
  }, 0n)
  const raw = total.toString().padStart(scale + 1, '0')
  const whole = raw.slice(0, raw.length - scale)
  const fraction = scale === 0 ? '' : raw.slice(raw.length - scale).replace(/0+$/, '')
  return fraction === '' ? whole : `${whole}.${fraction}`
}

// Narrows SDK contracts to the requested instrument when a token selector is present.
const filterHoldingsByInstrument = (
  holdings: TokenHolding[],
  instrumentId?: TokenInstrumentId,
): TokenHolding[] => {
  if (instrumentId === undefined) {
    return holdings
  }
  return holdings.filter((holding) => {
    const actual = holding.interfaceViewValue?.instrumentId
    return (
      (instrumentId.id === undefined || actual?.id === instrumentId.id) &&
      (instrumentId.admin === undefined || actual?.admin === instrumentId.admin)
    )
  })
}

// Builds balance summaries from UTXOs for generic CIP-56 tokens or Scan fallback.
const summarizeHoldingUtxos = (
  holdings: TokenHolding[],
  requestedInstrument?: TokenInstrumentId,
): TokenHoldingSummary[] => {
  const groups = new Map<string, TokenHolding[]>()
  for (const holding of filterHoldingsByInstrument(holdings, requestedInstrument)) {
    const key = instrumentKey(holding.interfaceViewValue?.instrumentId ?? requestedInstrument)
    groups.set(key, [...(groups.get(key) ?? []), holding])
  }
  return [...groups.entries()]
    .map(([key, tokenHoldings]) => {
      const firstInstrument =
        tokenHoldings[0]?.interfaceViewValue?.instrumentId ?? requestedInstrument
      const lockedCount = tokenHoldings.filter(
        (holding) => holding.interfaceViewValue?.lock != null,
      ).length
      return {
        key,
        tokenLabel: instrumentLabel(firstInstrument),
        instrumentId: firstInstrument,
        totalAmount: sumDecimalAmounts(
          tokenHoldings
            .map((holding) => holding.interfaceViewValue?.amount)
            .filter((amount): amount is string => amount !== undefined),
        ),
        utxoCount: tokenHoldings.length,
        lockedCount,
        unlockedCount: tokenHoldings.length - lockedCount,
        holdings: tokenHoldings,
        source: 'utxos' as const,
      }
    })
    .sort((a, b) => a.tokenLabel.localeCompare(b.tokenLabel))
}

export type Rpc = {
  handle: (request: JsonRpcRequest) => Promise<JsonRpcResponse | undefined>
  serviceInfo: () => Record<string, unknown>
  getSdk: () => Promise<WalletSdk>
}

export const createRpc = (config: WalletServiceConfig, deps: RpcDependencies = {}): Rpc => {
  const sdkFactory: SdkFactory =
    deps.sdkFactory ??
    (async (options: unknown) => {
      return await SDK.create(options as never)
    })
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  let sdkPromise: Promise<WalletSdk> | undefined
  let tokenSdkPromise: Promise<Cip56TokenSdk> | undefined

  const getSdk = async (): Promise<WalletSdk> => {
    if (config.canton.backendToken === undefined) {
      throw new Error('CANTON_BACKEND_TOKEN is required for Canton JSON API calls')
    }
    sdkPromise ??= sdkFactory({
      auth: { method: 'static', token: config.canton.backendToken },
      ledgerClientUrl: config.canton.jsonApiUrl,
      logAdapter: 'console',
    })
      .then((sdk) => sdk as WalletSdk)
      .catch((cause: unknown) => {
        sdkPromise = undefined
        throw new Error('Canton wallet SDK failed to initialize', { cause })
      })
    return await sdkPromise
  }

  const getTokenSdk = async (): Promise<Cip56TokenSdk> => {
    if (config.canton.backendToken === undefined) {
      throw new Error('CANTON_BACKEND_TOKEN is required for CIP-56 token helper calls')
    }
    const auth = { method: 'static', token: config.canton.backendToken }
    tokenSdkPromise ??= sdkFactory({
      auth,
      ledgerClientUrl: config.canton.jsonApiUrl,
      logAdapter: 'console',
      token: {
        validatorUrl: config.splice.validatorUrl,
        auth,
        registries: [config.splice.registryApiUrl],
      },
    })
      .then((sdk) => sdk as Cip56TokenSdk)
      .catch((cause: unknown) => {
        tokenSdkPromise = undefined
        throw new Error('CIP-56 wallet SDK failed to initialize', { cause })
      })
    return await tokenSdkPromise
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

  const cip56ListPendingTransfers = async (params: unknown): Promise<unknown> => {
    const p = objectParam<Record<string, unknown>>(params, 'cip56.listPendingTransfers')
    const partyId = requiredStringParam(p, 'partyId')
    const sdk = await getTokenSdk()
    return await sdk.token.transfer.pending(partyId)
  }

  const cip56ListHoldings = async (params: unknown): Promise<unknown> => {
    const p = objectParam<Record<string, unknown>>(params, 'cip56.listHoldings')
    const partyId = requiredStringParam(p, 'partyId')
    const sdk = await getTokenSdk()
    return await sdk.token.utxos.list({
      partyId,
      includeLocked: true,
      limit: 100,
      continueUntilCompletion: true,
    })
  }

  // Keeps the generic SDK UTXO list behind one helper so Scan fallback cannot diverge.
  const listHoldingUtxos = async (partyId: string): Promise<TokenHolding[]> => {
    const sdk = await getTokenSdk()
    return (await sdk.token.utxos.list({
      partyId,
      includeLocked: true,
      limit: 100,
      continueUntilCompletion: true,
    })) as TokenHolding[]
  }

  // Uses Scan's Amulet aggregate endpoint for fast CC balances.
  const scanAmuletHoldingSummary = async (
    partyId: string,
    instrumentId?: TokenInstrumentId,
  ): Promise<TokenHoldingSummary[]> => {
    const url = `${config.splice.scanApiUrl.replace(/\/$/, '')}/v0/holdings/summary`
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.canton.backendToken === undefined
          ? {}
          : { authorization: `Bearer ${config.canton.backendToken}` }),
      },
      body: JSON.stringify({
        migration_id: 0,
        record_time: now().toISOString(),
        record_time_match: 'at_or_before',
        owner_party_ids: [partyId],
      }),
    })
    if (!response.ok) {
      throw new Error(`Scan holdings summary failed with HTTP ${response.status}`)
    }
    const parsed = (await response.json()) as {
      summaries?: Array<{
        party_id: string
        total_unlocked_coin: string
        total_locked_coin: string
        total_coin_holdings: string
        accumulated_holding_fees_unlocked: string
        accumulated_holding_fees_locked: string
        accumulated_holding_fees_total: string
        total_available_coin: string
      }>
    }
    const summary = parsed.summaries?.find((item) => item.party_id === partyId)
    if (summary === undefined) {
      return []
    }
    const normalizedInstrument = {
      ...(instrumentId?.admin === undefined ? {} : { admin: instrumentId.admin }),
      id: instrumentId?.id ?? 'Amulet',
    }
    return [
      {
        key: instrumentKey(normalizedInstrument),
        tokenLabel: instrumentLabel(normalizedInstrument),
        instrumentId: normalizedInstrument,
        totalAmount: summary.total_available_coin,
        source: 'scan',
        scan: {
          totalUnlockedCoin: summary.total_unlocked_coin,
          totalLockedCoin: summary.total_locked_coin,
          totalCoinHoldings: summary.total_coin_holdings,
          accumulatedHoldingFeesUnlocked: summary.accumulated_holding_fees_unlocked,
          accumulatedHoldingFeesLocked: summary.accumulated_holding_fees_locked,
          accumulatedHoldingFeesTotal: summary.accumulated_holding_fees_total,
          totalAvailableCoin: summary.total_available_coin,
        },
      },
    ]
  }

  // Routes Amulet summaries through Scan and falls back to UTXOs when Scan is unavailable.
  const cip56ListHoldingSummary = async (params: unknown): Promise<TokenHoldingSummary[]> => {
    const p = objectParam<Record<string, unknown>>(params, 'cip56.listHoldingSummary')
    const partyId = requiredStringParam(p, 'partyId')
    const instrumentId = optionalInstrumentParam(p)
    if (isAmuletInstrument(instrumentId)) {
      try {
        return await scanAmuletHoldingSummary(partyId, instrumentId)
      } catch (error) {
        console.warn('[wallet-service] scan holding summary fallback', errorData(error))
      }
    }
    return summarizeHoldingUtxos(await listHoldingUtxos(partyId), instrumentId)
  }

  const cip56AcceptTransfer = async (
    params: unknown,
  ): Promise<{ commands: unknown; disclosedContracts: unknown[] }> => {
    const p = objectParam<Record<string, unknown>>(params, 'cip56.acceptTransfer')
    const transferInstructionCid = requiredStringParam(p, 'transferInstructionCid')
    const sdk = await getTokenSdk()
    const [commands, disclosedContracts] = await sdk.token.transfer.accept({
      transferInstructionCid,
      registryUrl: new URL(config.splice.registryApiUrl),
    })
    return { commands, disclosedContracts }
  }

  const cip56CreateTransfer = async (
    params: unknown,
  ): Promise<{ commands: unknown; disclosedContracts: unknown[] }> => {
    const p = objectParam<Record<string, unknown>>(params, 'cip56.createTransfer')
    const expirationDate = optionalDateParam(p, 'expirationDate')
    const sdk = await getTokenSdk()
    const [commands, disclosedContracts] = await sdk.token.transfer.create({
      sender: requiredStringParam(p, 'sender'),
      recipient: requiredStringParam(p, 'recipient'),
      amount: requiredStringParam(p, 'amount'),
      instrumentId: requiredStringParam(p, 'instrumentId'),
      registryUrl: new URL(config.splice.registryApiUrl),
      ...(typeof p.memo === 'string' && p.memo.trim() !== '' ? { memo: p.memo.trim() } : {}),
      ...(expirationDate === undefined ? {} : { expirationDate }),
    })
    return { commands, disclosedContracts }
  }

  // Normalizes SDK preapproval status into a stable JSON-RPC shape for Carpincho.
  const amuletPreapprovalStatus = async (params: unknown): Promise<AmuletPreapprovalStatus> => {
    const p = objectParam<Record<string, unknown>>(params, 'amulet.preapproval.status')
    const receiver = requiredStringParam(p, 'receiver')
    const sdk = await getTokenSdk()
    const status = await sdk.amulet?.preapproval.fetchStatus(receiver)
    if (status == null) {
      return { active: false, expired: false }
    }
    const expiresAt = new Date(status.expiresAt)
    const expiresAtIso = expiresAt.toISOString()
    const expired = expiresAt.getTime() <= now().getTime()
    return {
      contractId: status.contractId,
      templateId: status.templateId,
      expiresAt: expiresAtIso,
      active: !expired,
      expired,
    }
  }

  // Prepares the receiver-signed command that enables automatic Amulet receipts.
  const amuletPreapprovalCreate = async (
    params: unknown,
  ): Promise<{ commands: unknown; disclosedContracts: unknown[] }> => {
    const p = objectParam<Record<string, unknown>>(params, 'amulet.preapproval.create')
    const receiver = requiredStringParam(p, 'receiver')
    const sdk = await getTokenSdk()
    const commands = await sdk.amulet?.preapproval.command.create({ parties: { receiver } })
    return { commands, disclosedContracts: [] }
  }

  // Prepares the receiver-signed command that disables automatic Amulet receipts.
  const amuletPreapprovalCancel = async (
    params: unknown,
  ): Promise<{ commands: unknown; disclosedContracts: unknown[] }> => {
    const p = objectParam<Record<string, unknown>>(params, 'amulet.preapproval.cancel')
    const receiver = requiredStringParam(p, 'receiver')
    const sdk = await getTokenSdk()
    const [commands, disclosedContracts] = (await sdk.amulet?.preapproval.command.cancel({
      parties: { receiver },
    })) ?? [null, []]
    return { commands, disclosedContracts }
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
        case 'cip56.listPendingTransfers':
          return rpcResult(id, await cip56ListPendingTransfers(request.params))
        case 'cip56.listHoldings':
          return rpcResult(id, await cip56ListHoldings(request.params))
        case 'cip56.listHoldingSummary':
          return rpcResult(id, await cip56ListHoldingSummary(request.params))
        case 'cip56.acceptTransfer':
          return rpcResult(id, await cip56AcceptTransfer(request.params))
        case 'cip56.createTransfer':
          return rpcResult(id, await cip56CreateTransfer(request.params))
        case 'amulet.preapproval.status':
          return rpcResult(id, await amuletPreapprovalStatus(request.params))
        case 'amulet.preapproval.create':
          return rpcResult(id, await amuletPreapprovalCreate(request.params))
        case 'amulet.preapproval.cancel':
          return rpcResult(id, await amuletPreapprovalCancel(request.params))
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
      'cip56.listPendingTransfers',
      'cip56.listHoldings',
      'cip56.listHoldingSummary',
      'cip56.acceptTransfer',
      'cip56.createTransfer',
      'amulet.preapproval.status',
      'amulet.preapproval.create',
      'amulet.preapproval.cancel',
    ],
    reservedMethods: ['prepareExecute', 'prepareExecuteAndWait', 'signMessage'],
    adminEndpoints: ['POST /admin/party/prepare', 'POST /admin/party/complete'],
    network: config.network,
    provider: provider(),
    canton: {
      jsonApiUrl: config.canton.jsonApiUrl,
      ledgerApiUrl: config.canton.ledgerApiUrl,
      adminApiUrl: config.canton.adminApiUrl,
      hasBackendToken: config.canton.backendToken !== undefined,
    },
  })

  return { handle, serviceInfo, getSdk }
}
