import {
  jsonRpcError,
  jsonRpcResult,
  type RuntimeConnectedOriginsChangedMessage,
  type RuntimeGetConnectedOrigins,
  type RuntimeGetPendingRequests,
  type RuntimePendingRequest,
  type RuntimePendingRequestMessage,
  type RuntimeProviderResponse,
} from '@/extension/messages.ts'
import type { ProviderResponder } from '@/provider/dispatch.ts'

type RuntimeListener = (message: unknown) => void

type RuntimeApi = {
  sendMessage?: (message: unknown, callback: (response?: unknown) => void) => void
  lastError?: { message?: string }
  onMessage?: {
    addListener: (listener: RuntimeListener) => void
    removeListener: (listener: RuntimeListener) => void
  }
}

const runtime = (): RuntimeApi | undefined =>
  (globalThis as { chrome?: { runtime?: RuntimeApi } }).chrome?.runtime

export const isExtensionRuntime = (): boolean => runtime() !== undefined

const sendRuntimeMessage = async <T>(message: unknown): Promise<T> =>
  await new Promise<T>((resolve, reject) => {
    const api = runtime()
    if (api?.sendMessage === undefined) {
      reject(new Error('Carpincho extension runtime is not available'))
      return
    }
    api.sendMessage(message, (response) => {
      const lastError = api.lastError
      if (lastError !== undefined) {
        reject(new Error(lastError.message ?? 'Carpincho extension runtime failed'))
        return
      }
      resolve(response as T)
    })
  })

export const getPendingProviderRequests = async (): Promise<RuntimePendingRequest[]> =>
  await sendRuntimeMessage<RuntimePendingRequest[]>({
    type: 'CARPINCHO_GET_PENDING_REQUESTS',
  } satisfies RuntimeGetPendingRequests)

// Reads direct injected-provider dApp origins so the popup footer can show connection state.
export const getDirectConnectedOrigins = async (): Promise<string[]> =>
  await sendRuntimeMessage<string[]>({
    type: 'CARPINCHO_GET_CONNECTED_ORIGINS',
  } satisfies RuntimeGetConnectedOrigins)

export const createRuntimeResponder = (pending: RuntimePendingRequest): ProviderResponder => ({
  result: async (value) => {
    await sendRuntimeMessage<unknown>({
      type: 'CARPINCHO_PROVIDER_RESPONSE',
      requestId: pending.requestId,
      response: jsonRpcResult(pending.request.id, value),
    } satisfies RuntimeProviderResponse)
  },
  error: async (code, message) => {
    await sendRuntimeMessage<unknown>({
      type: 'CARPINCHO_PROVIDER_RESPONSE',
      requestId: pending.requestId,
      response: jsonRpcError(pending.request.id, code, message),
    } satisfies RuntimeProviderResponse)
  },
})

export const subscribeToPendingProviderRequests = (
  cb: (pending: RuntimePendingRequest) => void,
): (() => void) => {
  const api = runtime()
  const onMessage = api?.onMessage
  if (onMessage === undefined) {
    return () => undefined
  }
  const listener = (message: unknown): void => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as RuntimePendingRequestMessage).type === 'CARPINCHO_PENDING_REQUEST'
    ) {
      cb((message as RuntimePendingRequestMessage).pending)
    }
  }
  onMessage.addListener(listener)
  return () => onMessage.removeListener(listener)
}

// Subscribes to background pushes when direct dApp connection origins change.
export const subscribeToDirectConnectedOrigins = (
  cb: (origins: string[]) => void,
): (() => void) => {
  const api = runtime()
  const onMessage = api?.onMessage
  if (onMessage === undefined) {
    return () => undefined
  }
  const listener = (message: unknown): void => {
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as RuntimeConnectedOriginsChangedMessage).type ===
        'CARPINCHO_CONNECTED_ORIGINS_CHANGED' &&
      Array.isArray((message as RuntimeConnectedOriginsChangedMessage).origins)
    ) {
      cb((message as RuntimeConnectedOriginsChangedMessage).origins)
    }
  }
  onMessage.addListener(listener)
  return () => onMessage.removeListener(listener)
}
