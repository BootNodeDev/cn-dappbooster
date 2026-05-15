import {
  jsonRpcError,
  jsonRpcResult,
  type RuntimeGetPendingRequests,
  type RuntimePendingRequest,
  type RuntimePendingRequestMessage,
  type RuntimeProviderResponse
} from './messages.ts'
import type { ProviderResponder } from '../provider/dispatch.ts'

type RuntimeListener = (message: unknown) => void

type RuntimeApi = {
  sendMessage: (message: unknown, callback: (response?: unknown) => void) => void
  lastError?: { message?: string }
  onMessage: {
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
    if (api === undefined) {
      reject(new Error('Carpincho extension runtime is not available'))
      return
    }
    api.sendMessage(message, response => {
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
    type: 'CARPINCHO_GET_PENDING_REQUESTS'
  } satisfies RuntimeGetPendingRequests)

export const createRuntimeResponder = (pending: RuntimePendingRequest): ProviderResponder => ({
  result: async value => {
    await sendRuntimeMessage<unknown>({
      type: 'CARPINCHO_PROVIDER_RESPONSE',
      requestId: pending.requestId,
      response: jsonRpcResult(pending.request.id, value)
    } satisfies RuntimeProviderResponse)
  },
  error: async (code, message) => {
    await sendRuntimeMessage<unknown>({
      type: 'CARPINCHO_PROVIDER_RESPONSE',
      requestId: pending.requestId,
      response: jsonRpcError(pending.request.id, code, message)
    } satisfies RuntimeProviderResponse)
  }
})

export const subscribeToPendingProviderRequests = (
  cb: (pending: RuntimePendingRequest) => void
): (() => void) => {
  const api = runtime()
  if (api === undefined) {
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
  api.onMessage.addListener(listener)
  return () => api.onMessage.removeListener(listener)
}
