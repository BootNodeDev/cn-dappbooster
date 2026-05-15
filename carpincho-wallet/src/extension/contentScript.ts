import {
  CANTON_ANNOUNCE_PROVIDER_EVENT,
  CANTON_REQUEST_PROVIDER_EVENT,
  CARPINCHO_PROVIDER_DESCRIPTION,
  CARPINCHO_PROVIDER_ID,
  CARPINCHO_PROVIDER_NAME,
  WalletEvent,
  extensionAck,
  isForCarpincho,
  isSpliceWalletReady,
  isSpliceWalletRequest,
  jsonRpcError,
  type JsonRpcResponse,
  type RuntimeProviderRequest,
  type SpliceWalletResponseMessage
} from './messages.ts'

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
