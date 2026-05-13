import { WalletServiceRpcError, walletServiceRequest } from '../api/walletService.js'
import type { AccountPublic } from '../vault/types.js'
import {
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_IS_CONNECTED,
  CANTON_METHOD_LEDGER_API,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE,
  CANTON_METHOD_STATUS,
  getCantonNetwork,
  respondWithError,
  respondWithResult,
  type RequestEvent
} from './client.js'

const SIGNING_PROVIDER_ID = 'carpincho-wallet'

interface WalletServiceStatus {
  connection?: {
    isConnected?: boolean
    isNetworkConnected?: boolean
    reason?: string
    networkReason?: string
  }
  network?: {
    networkId?: string
  }
}

const partyNamespace = (partyId: string): string => {
  const idx = partyId.indexOf('::')
  return idx === -1 ? '' : partyId.slice(idx + 2)
}

const accountToCip103Wallet = (a: AccountPublic): {
  primary: boolean
  partyId: string
  status: 'allocated'
  hint: string
  publicKey: string
  namespace: string
  networkId: string
  signingProviderId: string
} => ({
  primary: a.isPrimary,
  partyId: a.partyId,
  status: 'allocated',
  hint: a.name,
  publicKey: a.publicKeyBase64,
  namespace: partyNamespace(a.partyId),
  networkId: a.network,
  signingProviderId: SIGNING_PROVIDER_ID
})

const normalizeMethod = (method: string): string => {
  if (!method.startsWith('canton_')) {
    return method
  }
  const raw = method.slice('canton_'.length)
  const normalized = `${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
  return normalized === 'prepareSignExecute' ? CANTON_METHOD_PREPARE_EXECUTE : normalized
}

const buildStatus = async (): Promise<{
  provider: { id: string; version: string; providerType: 'browser' }
  connection: { isConnected: true; isNetworkConnected: boolean; networkReason?: string }
  network: { networkId: string }
}> => {
  try {
    const remote = await walletServiceRequest<WalletServiceStatus>(CANTON_METHOD_STATUS)
    return {
      provider: { id: SIGNING_PROVIDER_ID, version: '0.1.0', providerType: 'browser' },
      connection: {
        isConnected: true,
        isNetworkConnected: remote.connection?.isNetworkConnected ?? false,
        ...(remote.connection?.networkReason === undefined ? {} : { networkReason: remote.connection.networkReason })
      },
      network: { networkId: remote.network?.networkId ?? getCantonNetwork() }
    }
  } catch (error) {
    return {
      provider: { id: SIGNING_PROVIDER_ID, version: '0.1.0', providerType: 'browser' },
      connection: {
        isConnected: true,
        isNetworkConnected: false,
        networkReason: `wallet-service unavailable: ${(error as Error).message}`
      },
      network: { networkId: getCantonNetwork() }
    }
  }
}

export type AccountResolver = () => {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export interface DispatchResult {
  status: 'handled' | 'pending-approval' | 'error'
  pendingMethod?:
    | typeof CANTON_METHOD_SIGN_MESSAGE
    | typeof CANTON_METHOD_PREPARE_EXECUTE
    | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
}

const forwardToWalletService = async (req: RequestEvent, method: string): Promise<DispatchResult> => {
  try {
    const result = await walletServiceRequest<unknown>(method, req.params.request.params)
    await respondWithResult(req.topic, req.id, result)
    return { status: 'handled' }
  } catch (error) {
    const code = error instanceof WalletServiceRpcError ? error.code : -32000
    await respondWithError(req.topic, req.id, code, `wallet-service: ${(error as Error).message}`)
    return { status: 'error' }
  }
}

// `resolve` is called lazily so newly added accounts are visible to in-flight requests.
export const dispatchRequest = async (
  req: RequestEvent,
  resolve: AccountResolver
): Promise<DispatchResult> => {
  const rawMethod = req.params.request.method
  const method = normalizeMethod(rawMethod)
  const { accounts, primary } = resolve()

  if (method === CANTON_METHOD_CONNECT || method === CANTON_METHOD_IS_CONNECTED) {
    const status = await buildStatus()
    await respondWithResult(req.topic, req.id, status.connection)
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_DISCONNECT) {
    await respondWithResult(req.topic, req.id, null)
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_LIST_ACCOUNTS) {
    await respondWithResult(req.topic, req.id, accounts.map(accountToCip103Wallet))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_GET_PRIMARY_ACCOUNT) {
    if (primary === null) {
      await respondWithError(req.topic, req.id, -32000, 'no primary account configured')
      return { status: 'error' }
    }
    await respondWithResult(req.topic, req.id, accountToCip103Wallet(primary))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_STATUS) {
    await respondWithResult(req.topic, req.id, await buildStatus())
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_GET_ACTIVE_NETWORK) {
    await respondWithResult(req.topic, req.id, { networkId: getCantonNetwork() })
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_SIGN_MESSAGE) {
    return { status: 'pending-approval', pendingMethod: CANTON_METHOD_SIGN_MESSAGE }
  }
  if (method === CANTON_METHOD_PREPARE_EXECUTE || method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT) {
    return {
      status: 'pending-approval',
      pendingMethod: rawMethod === 'canton_prepareSignExecute' ? CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT : method
    }
  }
  if (method === CANTON_METHOD_LEDGER_API) {
    return await forwardToWalletService(req, method)
  }

  await respondWithError(req.topic, req.id, -32601, `method not supported by Carpincho Wallet: ${req.params.request.method}`)
  return { status: 'error' }
}
