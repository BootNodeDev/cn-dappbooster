import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcError,
  jsonRpcResult,
} from '@/extension/messages'
import { dispatchProviderRequest } from '@/provider/dispatch'
import type { AccountPublic } from '@/vault/types'

export interface DirectProviderSnapshot {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export const createDirectProviderResponse = async (
  request: JsonRpcRequest,
  snapshot: DirectProviderSnapshot | null,
): Promise<JsonRpcResponse | undefined> => {
  if (snapshot === null) {
    return undefined
  }

  let response: JsonRpcResponse | undefined
  const result = await dispatchProviderRequest(
    { method: request.method, params: request.params },
    () => ({
      accounts: snapshot.accounts,
      primary: snapshot.primary,
    }),
    {
      result: async (value) => {
        response = jsonRpcResult(request.id, value)
      },
      error: async (code, message) => {
        response = jsonRpcError(request.id, code, message)
      },
    },
  )

  if (result.status === 'pending-approval') {
    return undefined
  }

  return response ?? jsonRpcError(request.id, -32603, 'Carpincho provider returned no response')
}
