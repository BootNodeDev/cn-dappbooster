import { WalletServiceRpcError, walletServiceRequest } from '../api/walletService.ts'
import { loadRuntimeConfig } from '../config/runtimeConfig.ts'
import type { AccountPublic } from '../vault/types.ts'
import { accountConnection } from '../wc/accounts.ts'

const SIGNING_PROVIDER_ID = 'carpincho-wallet'

export const CANTON_METHOD_CONNECT = 'connect'
export const CANTON_METHOD_DISCONNECT = 'disconnect'
export const CANTON_METHOD_IS_CONNECTED = 'isConnected'
export const CANTON_METHOD_PREPARE_EXECUTE = 'prepareExecute'
export const CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT = 'prepareExecuteAndWait'
export const CANTON_METHOD_LIST_ACCOUNTS = 'listAccounts'
export const CANTON_METHOD_GET_PRIMARY_ACCOUNT = 'getPrimaryAccount'
export const CANTON_METHOD_GET_ACTIVE_NETWORK = 'getActiveNetwork'
export const CANTON_METHOD_STATUS = 'status'
export const CANTON_METHOD_LEDGER_API = 'ledgerApi'
export const CANTON_METHOD_SIGN_MESSAGE = 'signMessage'

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

export interface ProviderRequest {
  method: string
  params?: unknown
}

export interface ProviderResponder {
  result: (value: unknown) => Promise<void>
  error: (code: number, message: string) => Promise<void>
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

const normalizeCantonNetwork = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return 'canton:local'
  }
  return trimmed.startsWith('canton:') ? trimmed : `canton:${trimmed}`
}

const getCantonNetwork = (): string => normalizeCantonNetwork(loadRuntimeConfig().cantonNetwork)

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

const forwardToWalletService = async (
  request: ProviderRequest,
  method: string,
  responder: ProviderResponder
): Promise<DispatchResult> => {
  try {
    const result = await walletServiceRequest<unknown>(method, request.params)
    await responder.result(result)
    return { status: 'handled' }
  } catch (error) {
    const code = error instanceof WalletServiceRpcError ? error.code : -32000
    await responder.error(code, `wallet-service: ${(error as Error).message}`)
    return { status: 'error' }
  }
}

export const dispatchProviderRequest = async (
  request: ProviderRequest,
  resolve: AccountResolver,
  responder: ProviderResponder
): Promise<DispatchResult> => {
  const rawMethod = request.method
  const method = normalizeMethod(rawMethod)
  const { accounts, primary } = resolve()

  if (method === CANTON_METHOD_CONNECT || method === CANTON_METHOD_IS_CONNECTED) {
    const status = await buildStatus()
    await responder.result(accountConnection({ accounts, primary }, status.connection))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_DISCONNECT) {
    await responder.result(null)
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_LIST_ACCOUNTS) {
    await responder.result(accounts.map(accountToCip103Wallet))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_GET_PRIMARY_ACCOUNT) {
    if (primary === null) {
      await responder.error(-32000, 'no primary account configured')
      return { status: 'error' }
    }
    await responder.result(accountToCip103Wallet(primary))
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_STATUS) {
    const status = await buildStatus()
    await responder.result({
      ...status,
      connection: accountConnection({ accounts, primary }, status.connection)
    })
    return { status: 'handled' }
  }
  if (method === CANTON_METHOD_GET_ACTIVE_NETWORK) {
    await responder.result({ networkId: getCantonNetwork() })
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
    return await forwardToWalletService(request, method, responder)
  }

  await responder.error(-32601, `method not supported by Carpincho Wallet: ${request.method}`)
  return { status: 'error' }
}
