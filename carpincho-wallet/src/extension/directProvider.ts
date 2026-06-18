import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  jsonRpcError,
  jsonRpcResult,
} from '@/extension/messages'
import { dispatchProviderRequest } from '@/provider/dispatch'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_IS_CONNECTED,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_STATUS,
  normalizeMethod,
} from '@/provider/methods'
import type { AccountPublic } from '@/vault/types'

export interface DirectProviderSnapshot {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export interface DirectProviderContext {
  // Whether the requesting origin has been granted access via an approved connect.
  isConnected: boolean
}

// Account-disclosing queries that may run for an unapproved origin only against an
// empty snapshot, so they report a disconnected state without leaking party data.
const NON_CONNECTED_QUERY_METHODS = new Set<string>([
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_STATUS,
  CANTON_METHOD_IS_CONNECTED,
])

const EMPTY_SNAPSHOT: DirectProviderSnapshot = { accounts: [], primary: null }

// Runs the shared provider dispatch against a chosen snapshot and materializes a
// JSON-RPC response. Returns undefined when the method needs popup approval so the
// caller queues it for the user.
const runDispatch = async (
  request: JsonRpcRequest,
  snapshot: DirectProviderSnapshot,
): Promise<JsonRpcResponse | undefined> => {
  let response: JsonRpcResponse | undefined
  const result = await dispatchProviderRequest(
    { method: request.method, params: request.params },
    () => ({ accounts: snapshot.accounts, primary: snapshot.primary }),
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

// Answers an injected-provider request, enforcing that only an origin the user has
// approved (`connect`) can reach account identity or signing. Unapproved origins get
// a disconnected view; `connect` itself is queued for explicit user approval.
export const createDirectProviderResponse = async (
  request: JsonRpcRequest,
  snapshot: DirectProviderSnapshot | null,
  context: DirectProviderContext = { isConnected: false },
): Promise<JsonRpcResponse | undefined> => {
  if (snapshot === null) {
    // Wallet locked / no snapshot: queue so the popup can prompt for unlock.
    return undefined
  }

  const method = normalizeMethod(request.method)

  // A connected origin is allowed everything; network discovery and disconnect never
  // disclose account identity, so they are allowed regardless of connection state.
  if (
    context.isConnected ||
    method === CANTON_METHOD_GET_ACTIVE_NETWORK ||
    method === CANTON_METHOD_DISCONNECT
  ) {
    return runDispatch(request, snapshot)
  }

  // Origin has not been granted access by the user yet.
  if (method === CANTON_METHOD_CONNECT) {
    // Queue: the popup prompts the user to approve this origin before any accounts leave the wallet.
    return undefined
  }
  if (NON_CONNECTED_QUERY_METHODS.has(method)) {
    // Answer from an empty snapshot: reports isConnected:false / empty accounts, leaks nothing.
    return runDispatch(request, EMPTY_SNAPSHOT)
  }
  // signMessage / prepareExecute / ledgerApi / unknown: refuse without prompting.
  return jsonRpcError(
    request.id,
    -32000,
    'not connected: call connect and approve it in Carpincho first',
  )
}
