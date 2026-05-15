import {
  jsonRpcError,
  type JsonRpcResponse,
  type RuntimeGetPendingRequests,
  type RuntimePendingRequest,
  type RuntimePendingRequestMessage,
  type RuntimeProviderRequest,
  type RuntimeProviderResponse
} from './messages.ts'

type RuntimeMessage =
  | RuntimeProviderRequest
  | RuntimeProviderResponse
  | RuntimeGetPendingRequests

type RuntimeSender = {
  tab?: {
    id?: number
  }
}

type RuntimeApi = {
  getURL: (path: string) => string
  onMessage: {
    addListener: (
      listener: (
        message: RuntimeMessage,
        sender: RuntimeSender,
        sendResponse: (response?: unknown) => void
      ) => boolean | void
    ) => void
  }
  sendMessage: (message: RuntimePendingRequestMessage) => Promise<unknown>
}

type WindowsApi = {
  create: (createData: {
    url: string
    type: 'popup'
    width: number
    height: number
    focused: boolean
  }) => Promise<unknown>
}

const chromeApi = (globalThis as {
  chrome?: {
    runtime?: RuntimeApi
    windows?: WindowsApi
  }
}).chrome

const pendingRequests = new Map<string, {
  pending: RuntimePendingRequest
  sendResponse: (response: JsonRpcResponse) => void
}>()

const requestId = (request: RuntimeProviderRequest['request']): string =>
  typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : crypto.randomUUID()

const pendingList = (): RuntimePendingRequest[] =>
  [...pendingRequests.values()]
    .map(entry => entry.pending)
    .sort((a, b) => a.createdAt - b.createdAt)

const notifyWalletViews = async (pending: RuntimePendingRequest): Promise<void> => {
  await chromeApi?.runtime?.sendMessage({
    type: 'CARPINCHO_PENDING_REQUEST',
    pending
  }).catch(() => undefined)
}

const openWalletWindow = async (): Promise<void> => {
  const url = chromeApi?.runtime?.getURL('index.html')
  if (url === undefined) {
    return
  }
  await chromeApi?.windows?.create({
    url,
    type: 'popup',
    width: 460,
    height: 720,
    focused: true
  }).catch(() => undefined)
}

chromeApi?.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CARPINCHO_PROVIDER_REQUEST') {
    const id = requestId(message.request)
    const pending: RuntimePendingRequest = {
      requestId: id,
      request: message.request,
      origin: message.origin,
      createdAt: Date.now()
    }
    pendingRequests.set(id, {
      pending,
      sendResponse: response => sendResponse(response)
    })
    void notifyWalletViews(pending)
    void openWalletWindow()
    return true
  }

  if (message.type === 'CARPINCHO_GET_PENDING_REQUESTS') {
    sendResponse(pendingList())
    return false
  }

  if (message.type === 'CARPINCHO_PROVIDER_RESPONSE') {
    const pending = pendingRequests.get(message.requestId)
    if (pending === undefined) {
      sendResponse({ ok: false })
      return false
    }
    pendingRequests.delete(message.requestId)
    pending.sendResponse(message.response)
    sendResponse({ ok: true })
    return false
  }

  sendResponse(jsonRpcError(null, -32601, 'Unknown Carpincho runtime message'))
  return false
})
