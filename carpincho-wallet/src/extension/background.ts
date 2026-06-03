import { directConnectionUpdateFromProviderResponse } from '@/extension/directConnectionState'
import {
  forgetDirectConnectedOrigin,
  readDirectConnectedOrigins,
  rememberDirectConnectedOrigin,
} from '@/extension/directConnections'
import { createDirectProviderResponse } from '@/extension/directProvider'
import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcError,
  type RuntimeBroadcastEvent,
  type RuntimeEventRelay,
  type RuntimeForgetConnectedOrigin,
  type RuntimeGetConnectedOrigins,
  type RuntimeGetPendingRequests,
  type RuntimePendingRequest,
  type RuntimePendingRequestMessage,
  type RuntimeProviderRequest,
  type RuntimeProviderResponse,
} from '@/extension/messages'
import { readWalletSnapshot } from '@/extension/walletSnapshot'

type RuntimeMessage =
  | RuntimeProviderRequest
  | RuntimeProviderResponse
  | RuntimeGetPendingRequests
  | RuntimeGetConnectedOrigins
  | RuntimeForgetConnectedOrigin
  | RuntimeBroadcastEvent

type RuntimeSender = {
  tab?: {
    id?: number
  }
}

type TabsApi = {
  query: (queryInfo: { url?: string | string[] }) => Promise<Array<{ id?: number }>>
  sendMessage: (tabId: number, message: RuntimeEventRelay) => Promise<unknown>
}

type RuntimeApi = {
  getURL: (path: string) => string
  onMessage: {
    addListener: (
      listener: (
        message: RuntimeMessage,
        sender: RuntimeSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | undefined,
    ) => void
  }
  sendMessage: (message: RuntimePendingRequestMessage) => Promise<unknown>
}

type ActionApi = {
  openPopup?: () => Promise<void> | void
  setBadgeText?: (details: { text: string }) => Promise<void> | void
  setBadgeBackgroundColor?: (details: { color: string }) => Promise<void> | void
}

const chromeApi = (
  globalThis as {
    chrome?: {
      runtime?: RuntimeApi
      action?: ActionApi
      tabs?: TabsApi
    }
  }
).chrome

// Keep in sync with public/manifest.json `content_scripts.matches`; drift means missed pages.
const CONTENT_SCRIPT_MATCHES = [
  'http://localhost/*',
  'http://127.0.0.1/*',
  'https://localhost/*',
  'https://127.0.0.1/*',
]

const relayBroadcastToTabs = async (message: RuntimeBroadcastEvent): Promise<void> => {
  const tabs = await chromeApi?.tabs?.query({ url: CONTENT_SCRIPT_MATCHES }).catch(() => [])
  if (tabs === undefined) {
    return
  }
  const relay: RuntimeEventRelay = {
    type: 'CARPINCHO_EVENT_RELAY',
    eventName: message.eventName,
    payload: message.payload,
  }
  await Promise.all(
    tabs.map((tab) => {
      if (tab.id === undefined) {
        return Promise.resolve()
      }
      return chromeApi?.tabs?.sendMessage(tab.id, relay).catch(() => undefined)
    }),
  )
}

const pendingRequests = new Map<
  string,
  {
    pending: RuntimePendingRequest
    sendResponse: (response: JsonRpcResponse) => void
  }
>()

const requestId = (request: RuntimeProviderRequest['request']): string =>
  typeof request.id === 'string' || typeof request.id === 'number'
    ? String(request.id)
    : crypto.randomUUID()

const pendingList = (): RuntimePendingRequest[] =>
  [...pendingRequests.values()]
    .map((entry) => entry.pending)
    .sort((a, b) => a.createdAt - b.createdAt)

const notifyWalletViews = async (pending: RuntimePendingRequest): Promise<void> => {
  await chromeApi?.runtime
    ?.sendMessage({
      type: 'CARPINCHO_PENDING_REQUEST',
      pending,
    })
    .catch(() => undefined)
}

// Applies a provider response to the direct dApp origin registry used by the footer.
const applyDirectConnectionUpdate = async (
  { origin, request }: { origin: string; request: JsonRpcRequest },
  response: JsonRpcResponse,
): Promise<void> => {
  const update = directConnectionUpdateFromProviderResponse({ origin, request, response })
  if (update.action === 'none') {
    return
  }
  if (update.action === 'remember') {
    await rememberDirectConnectedOrigin(update.origin)
  } else {
    await forgetDirectConnectedOrigin(update.origin)
  }
}

const updateActionBadge = async (): Promise<void> => {
  const count = pendingRequests.size
  await chromeApi?.action?.setBadgeText?.({
    text: count === 0 ? '' : String(count),
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
  sendResponse: (response?: unknown) => void,
): Promise<void> => {
  const id = requestId(message.request)
  const pending: RuntimePendingRequest = {
    requestId: id,
    request: message.request,
    origin: message.origin,
    createdAt: Date.now(),
  }
  pendingRequests.set(id, {
    pending,
    sendResponse: (response) => sendResponse(response),
  })
  await updateActionBadge().catch(() => undefined)
  await notifyWalletViews(pending)
  await openWalletPopup().catch(() => undefined)
}

const handleProviderRequest = async (
  message: RuntimeProviderRequest,
  sendResponse: (response?: unknown) => void,
): Promise<void> => {
  const directResponse = await createDirectProviderResponse(
    message.request,
    await readWalletSnapshot().catch(() => null),
  )
  if (directResponse !== undefined) {
    await applyDirectConnectionUpdate(
      { origin: message.origin, request: message.request },
      directResponse,
    ).catch(() => undefined)
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

  if (message.type === 'CARPINCHO_GET_CONNECTED_ORIGINS') {
    void readDirectConnectedOrigins()
      .then(sendResponse)
      .catch(() => sendResponse([]))
    return true
  }

  if (message.type === 'CARPINCHO_FORGET_CONNECTED_ORIGIN') {
    void forgetDirectConnectedOrigin(message.origin)
      .then(sendResponse)
      .catch(() => sendResponse([]))
    return true
  }

  if (message.type === 'CARPINCHO_BROADCAST_EVENT') {
    void relayBroadcastToTabs(message)
    sendResponse({ ok: true })
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
    void applyDirectConnectionUpdate(
      { origin: pending.pending.origin, request: pending.pending.request },
      message.response,
    ).catch(() => undefined)
    void updateActionBadge().catch(() => undefined)
    sendResponse({ ok: true })
    return false
  }

  sendResponse(jsonRpcError(null, -32601, 'Unknown Carpincho runtime message'))
  return false
})
