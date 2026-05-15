import {
  jsonRpcError,
  type JsonRpcResponse,
  type RuntimeGetPendingRequests,
  type RuntimePendingRequest,
  type RuntimePendingRequestMessage,
  type RuntimeProviderRequest,
  type RuntimeProviderResponse
} from './messages.ts'
import { createDirectProviderResponse } from './directProvider.ts'
import { readWalletSnapshot } from './walletSnapshot.ts'

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

type ActionApi = {
  openPopup?: () => Promise<void> | void
  setBadgeText?: (details: { text: string }) => Promise<void> | void
  setBadgeBackgroundColor?: (details: { color: string }) => Promise<void> | void
}

const chromeApi = (globalThis as {
  chrome?: {
    runtime?: RuntimeApi
    action?: ActionApi
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

const updateActionBadge = async (): Promise<void> => {
  const count = pendingRequests.size
  await chromeApi?.action?.setBadgeText?.({
    text: count === 0 ? '' : String(count)
  })
  if (count > 0) {
    await chromeApi?.action?.setBadgeBackgroundColor?.({ color: '#b83242' })
  }
}

const openWalletPopup = async (): Promise<void> => {
  await chromeApi?.action?.openPopup?.()
}

const queueProviderRequest = async (
  message: RuntimeProviderRequest,
  sendResponse: (response?: unknown) => void
): Promise<void> => {
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
  await updateActionBadge().catch(() => undefined)
  await notifyWalletViews(pending)
  await openWalletPopup().catch(() => undefined)
}

const handleProviderRequest = async (
  message: RuntimeProviderRequest,
  sendResponse: (response?: unknown) => void
): Promise<void> => {
  const directResponse = await createDirectProviderResponse(
    message.request,
    await readWalletSnapshot().catch(() => null)
  )
  if (directResponse !== undefined) {
    sendResponse(directResponse)
    return
  }
  await queueProviderRequest(message, sendResponse)
}

chromeApi?.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CARPINCHO_PROVIDER_REQUEST') {
    void handleProviderRequest(message, sendResponse)
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
    void updateActionBadge().catch(() => undefined)
    sendResponse({ ok: true })
    return false
  }

  sendResponse(jsonRpcError(null, -32601, 'Unknown Carpincho runtime message'))
  return false
})
