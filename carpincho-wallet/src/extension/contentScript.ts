const CARPINCHO_PROVIDER_ID = 'carpincho-wallet'
const CARPINCHO_PROVIDER_NAME = 'Carpincho Wallet'
const CARPINCHO_PROVIDER_DESCRIPTION = 'Connect with the Carpincho browser extension wallet'

const WalletEvent = {
  SPLICE_WALLET_REQUEST: 'SPLICE_WALLET_REQUEST',
  SPLICE_WALLET_RESPONSE: 'SPLICE_WALLET_RESPONSE',
  SPLICE_WALLET_EXT_READY: 'SPLICE_WALLET_EXT_READY',
  SPLICE_WALLET_EXT_ACK: 'SPLICE_WALLET_EXT_ACK'
} as const

const CANTON_REQUEST_PROVIDER_EVENT = 'canton:requestProvider'
const CANTON_ANNOUNCE_PROVIDER_EVENT = 'canton:announceProvider'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id?: string | number | null
  method: string
  params?: unknown
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

interface RuntimeProviderRequest {
  type: 'CARPINCHO_PROVIDER_REQUEST'
  request: JsonRpcRequest
  origin: string
}

interface SpliceWalletRequestMessage {
  type: typeof WalletEvent.SPLICE_WALLET_REQUEST
  request: JsonRpcRequest
  target?: string
}

interface SpliceWalletResponseMessage {
  type: typeof WalletEvent.SPLICE_WALLET_RESPONSE
  response: JsonRpcResponse
}

interface SpliceWalletReadyMessage {
  type: typeof WalletEvent.SPLICE_WALLET_EXT_READY
  target?: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isForCarpincho = (message: { target?: unknown }): boolean =>
  message.target === undefined || message.target === CARPINCHO_PROVIDER_ID

const isSpliceWalletReady = (value: unknown): value is SpliceWalletReadyMessage =>
  isRecord(value) && value.type === WalletEvent.SPLICE_WALLET_EXT_READY

const isSpliceWalletRequest = (value: unknown): value is SpliceWalletRequestMessage =>
  isRecord(value) &&
  value.type === WalletEvent.SPLICE_WALLET_REQUEST &&
  isRecord(value.request) &&
  value.request.jsonrpc === '2.0' &&
  typeof value.request.method === 'string'

const extensionAck = (): { type: typeof WalletEvent.SPLICE_WALLET_EXT_ACK; target: typeof CARPINCHO_PROVIDER_ID } => ({
  type: WalletEvent.SPLICE_WALLET_EXT_ACK,
  target: CARPINCHO_PROVIDER_ID
})

const jsonRpcError = (id: JsonRpcRequest['id'], code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data }
})

type RuntimeApi = {
  id: string
  getURL: (path: string) => string
  lastError?: { message?: string }
  sendMessage: (message: RuntimeProviderRequest, callback: (response?: JsonRpcResponse) => void) => void
}

const runtime = (globalThis as { chrome?: { runtime?: RuntimeApi } }).chrome?.runtime

const announceProvider = (): void => {
  if (runtime === undefined) {
    return
  }
  window.dispatchEvent(new CustomEvent(CANTON_ANNOUNCE_PROVIDER_EVENT, {
    detail: {
      id: CARPINCHO_PROVIDER_ID,
      name: CARPINCHO_PROVIDER_NAME,
      icon: runtime.getURL('icons/carpincho-48.png'),
      description: CARPINCHO_PROVIDER_DESCRIPTION,
      target: CARPINCHO_PROVIDER_ID
    }
  }))
}

const runtimeRequest = async (message: RuntimeProviderRequest): Promise<JsonRpcResponse> =>
  await new Promise<JsonRpcResponse>((resolve, reject) => {
    if (runtime === undefined) {
      reject(new Error('Carpincho extension runtime is not available'))
      return
    }
    runtime.sendMessage(message, response => {
      const lastError = runtime.lastError
      if (lastError !== undefined) {
        reject(new Error(lastError.message ?? 'Carpincho extension runtime failed'))
        return
      }
      if (response === undefined) {
        reject(new Error('Carpincho extension returned no response'))
        return
      }
      resolve(response)
    })
  })

const postResponse = (response: JsonRpcResponse): void => {
  const message: SpliceWalletResponseMessage = {
    type: WalletEvent.SPLICE_WALLET_RESPONSE,
    response
  }
  window.postMessage(message, '*')
}

window.addEventListener(CANTON_REQUEST_PROVIDER_EVENT, announceProvider)
queueMicrotask(announceProvider)

window.addEventListener('message', event => {
  if (event.source !== window) {
    return
  }
  const data = event.data as unknown
  if (isSpliceWalletReady(data) && isForCarpincho(data)) {
    window.postMessage(extensionAck(), '*')
    return
  }
  if (!isSpliceWalletRequest(data) || !isForCarpincho(data)) {
    return
  }
  void runtimeRequest({
    type: 'CARPINCHO_PROVIDER_REQUEST',
    request: data.request,
    origin: window.location.origin
  })
    .then(postResponse)
    .catch(error => {
      postResponse(jsonRpcError(data.request.id, -32000, (error as Error).message))
    })
})
