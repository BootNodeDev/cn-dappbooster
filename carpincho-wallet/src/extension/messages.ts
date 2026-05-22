export const CARPINCHO_PROVIDER_ID = 'carpincho-wallet'
export const CARPINCHO_PROVIDER_NAME = 'Carpincho Wallet'
export const CARPINCHO_PROVIDER_DESCRIPTION = 'Connect with the Carpincho browser extension wallet'

export const WalletEvent = {
  SPLICE_WALLET_REQUEST: 'SPLICE_WALLET_REQUEST',
  SPLICE_WALLET_RESPONSE: 'SPLICE_WALLET_RESPONSE',
  SPLICE_WALLET_EXT_READY: 'SPLICE_WALLET_EXT_READY',
  SPLICE_WALLET_EXT_ACK: 'SPLICE_WALLET_EXT_ACK',
  SPLICE_WALLET_EXT_OPEN: 'SPLICE_WALLET_EXT_OPEN',
  // Carpincho-defined extension to the canonical SPLICE_WALLET_* set:
  // wallet → page push for dapp-api event methods (accountsChanged, txChanged, ...)
  // that the canonical extension transport doesn't yet define a channel for.
  SPLICE_WALLET_EVENT: 'SPLICE_WALLET_EVENT',
} as const

type WalletEventValue<K extends keyof typeof WalletEvent> = (typeof WalletEvent)[K]

export const CANTON_REQUEST_PROVIDER_EVENT = 'canton:requestProvider'
export const CANTON_ANNOUNCE_PROVIDER_EVENT = 'canton:announceProvider'

export interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: unknown
}

export interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export interface SpliceWalletRequestMessage {
  type: WalletEventValue<'SPLICE_WALLET_REQUEST'>
  request: JsonRpcRequest
  target?: string
}

export interface SpliceWalletResponseMessage {
  type: WalletEventValue<'SPLICE_WALLET_RESPONSE'>
  response: JsonRpcResponse
}

export interface SpliceWalletReadyMessage {
  type: WalletEventValue<'SPLICE_WALLET_EXT_READY'>
  target?: string
}

export interface SpliceWalletAckMessage {
  type: WalletEventValue<'SPLICE_WALLET_EXT_ACK'>
  target: typeof CARPINCHO_PROVIDER_ID
}

export interface RuntimeProviderRequest {
  type: 'CARPINCHO_PROVIDER_REQUEST'
  request: JsonRpcRequest
  origin: string
}

export interface RuntimePendingRequest {
  requestId: string
  request: JsonRpcRequest
  origin: string
  createdAt: number
}

export interface RuntimePendingRequestMessage {
  type: 'CARPINCHO_PENDING_REQUEST'
  pending: RuntimePendingRequest
}

export interface RuntimeProviderResponse {
  type: 'CARPINCHO_PROVIDER_RESPONSE'
  requestId: string
  response: JsonRpcResponse
}

export interface RuntimeGetPendingRequests {
  type: 'CARPINCHO_GET_PENDING_REQUESTS'
}

export interface RuntimeGetConnectedOrigins {
  type: 'CARPINCHO_GET_CONNECTED_ORIGINS'
}

export interface RuntimeConnectedOriginsChangedMessage {
  type: 'CARPINCHO_CONNECTED_ORIGINS_CHANGED'
  origins: string[]
}

// Wallet→page event broadcast. Runs popup → background (CARPINCHO_BROADCAST_EVENT)
// → content script (CARPINCHO_EVENT_RELAY) → page (SPLICE_WALLET_EVENT).
// `eventName` matches the dapp-api spec method names (accountsChanged,
// txChanged, ...). `payload` matches the corresponding *Event schema.
export interface RuntimeBroadcastEvent {
  type: 'CARPINCHO_BROADCAST_EVENT'
  eventName: string
  payload: unknown
}

export interface RuntimeEventRelay {
  type: 'CARPINCHO_EVENT_RELAY'
  eventName: string
  payload: unknown
}

export interface SpliceWalletEventMessage {
  type: WalletEventValue<'SPLICE_WALLET_EVENT'>
  eventName: string
  payload: unknown
  target?: string
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

export const isSpliceWalletEvent = (value: unknown): value is SpliceWalletEventMessage =>
  isRecord(value) &&
  value.type === WalletEvent.SPLICE_WALLET_EVENT &&
  typeof value.eventName === 'string'

export const isForCarpincho = (message: { target?: unknown }): boolean =>
  message.target === undefined || message.target === CARPINCHO_PROVIDER_ID

export const isSpliceWalletReady = (value: unknown): value is SpliceWalletReadyMessage =>
  isRecord(value) && value.type === WalletEvent.SPLICE_WALLET_EXT_READY

export const isSpliceWalletRequest = (value: unknown): value is SpliceWalletRequestMessage =>
  isRecord(value) &&
  value.type === WalletEvent.SPLICE_WALLET_REQUEST &&
  isRecord(value.request) &&
  value.request.jsonrpc === '2.0' &&
  typeof value.request.method === 'string'

export const extensionAck = (): SpliceWalletAckMessage => ({
  type: WalletEvent.SPLICE_WALLET_EXT_ACK,
  target: CARPINCHO_PROVIDER_ID,
})

export const jsonRpcResult = (id: JsonRpcRequest['id'], result: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  result,
})

export const jsonRpcError = (
  id: JsonRpcRequest['id'],
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data },
})
