import type { JsonRpcRequest, JsonRpcResponse } from '@/extension/messages'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  normalizeMethod,
} from '@/provider/methods'

export type DirectConnectionUpdate =
  | { action: 'remember'; origin: string }
  | { action: 'forget'; origin: string }
  | { action: 'none' }

// Normalizes direct-provider page URLs into stable http origins for route-independent matching.
export const normalizeDirectConnectionOrigin = (value: string): string | undefined => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : undefined
  } catch {
    return undefined
  }
}

// Detects the CIP-0103 connect response shape that means the dApp is connected to this wallet.
const isConnectedResult = (response: JsonRpcResponse): boolean => {
  const result = response.result
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { isConnected?: unknown }).isConnected === true
  )
}

// Derives the direct-origin state update caused by a provider request/response pair.
export const directConnectionUpdateFromProviderResponse = ({
  origin,
  request,
  response,
}: {
  origin: string
  request: JsonRpcRequest
  response: JsonRpcResponse
}): DirectConnectionUpdate => {
  if (response.error !== undefined) {
    return { action: 'none' }
  }

  const normalizedOrigin = normalizeDirectConnectionOrigin(origin)
  if (normalizedOrigin === undefined) {
    return { action: 'none' }
  }

  const method = normalizeMethod(request.method)
  if (method === CANTON_METHOD_CONNECT && isConnectedResult(response)) {
    return { action: 'remember', origin: normalizedOrigin }
  }
  if (method === CANTON_METHOD_DISCONNECT) {
    return { action: 'forget', origin: normalizedOrigin }
  }
  return { action: 'none' }
}
