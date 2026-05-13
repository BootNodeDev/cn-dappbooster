import { Core } from '@walletconnect/core'
import SignClient from '@walletconnect/sign-client'
import { formatJsonRpcResult, formatJsonRpcError } from '@walletconnect/jsonrpc-utils'
import { getSdkError } from '@walletconnect/utils'
import type { SignClientTypes } from '@walletconnect/types'
import { loadRuntimeConfig } from '../config/runtimeConfig.js'

export const CANTON_NAMESPACE = 'canton'

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

const LEGACY_CANTON_METHODS = [
  'canton_prepareSignExecute',
  'canton_listAccounts',
  'canton_getPrimaryAccount',
  'canton_getActiveNetwork',
  'canton_status',
  'canton_ledgerApi',
  'canton_signMessage'
]

// Must be a superset of what @canton-network/dapp-sdk's WalletConnectAdapter requires.
export const CIP103_METHODS = [
  CANTON_METHOD_CONNECT,
  CANTON_METHOD_DISCONNECT,
  CANTON_METHOD_IS_CONNECTED,
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_LIST_ACCOUNTS,
  CANTON_METHOD_GET_PRIMARY_ACCOUNT,
  CANTON_METHOD_GET_ACTIVE_NETWORK,
  CANTON_METHOD_STATUS,
  CANTON_METHOD_LEDGER_API,
  CANTON_METHOD_SIGN_MESSAGE,
  ...LEGACY_CANTON_METHODS
]

export const CIP103_EVENTS = ['accountsChanged', 'statusChanged', 'txChanged']

const normalizeCantonNetwork = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return 'canton:local'
  }
  return trimmed.startsWith(`${CANTON_NAMESPACE}:`) ? trimmed : `${CANTON_NAMESPACE}:${trimmed}`
}

const getWalletConnectProjectId = (): string =>
  ((import.meta.env['VITE_WC_PROJECT_ID'] as string | undefined) ?? '').trim()

export const getCantonNetwork = (): string =>
  normalizeCantonNetwork(loadRuntimeConfig().cantonNetwork)
export const getCantonChain = (): string => getCantonNetwork()

let signClientPromise: Promise<InstanceType<typeof SignClient>> | undefined
let signClientProjectId: string | undefined

export const getSignClient = async (): Promise<InstanceType<typeof SignClient>> => {
  const projectId = getWalletConnectProjectId()
  if (signClientPromise !== undefined && signClientProjectId === projectId) {
    return await signClientPromise
  }
  if (projectId === '') {
    throw new Error('WalletConnect project id is not set')
  }
  signClientProjectId = projectId
  signClientPromise = (async () => {
    const core = new Core({ projectId, customStoragePrefix: 'carpincho-wallet' })
    return await SignClient.init({
      core,
      metadata: {
        name: 'Carpincho Wallet',
        description: 'Argentinian Canton wallet',
        url: window.location.origin,
        icons: [`${window.location.origin}/carpincho-icon.svg`]
      }
    })
  })().catch((err: unknown) => {
    if (signClientProjectId === projectId) {
      signClientProjectId = undefined
      signClientPromise = undefined
    }
    throw err
  })
  return await signClientPromise
}

const partyIdToAccount = (partyId: string): string => `${getCantonChain()}:${encodeURIComponent(partyId)}`

export const approveProposal = async (args: { proposalId: number; partyId: string }): Promise<void> => {
  const client = await getSignClient()
  await client.approve({
    id: args.proposalId,
    namespaces: {
      [CANTON_NAMESPACE]: {
        accounts: [partyIdToAccount(args.partyId)],
        chains: [getCantonChain()],
        methods: CIP103_METHODS,
        events: CIP103_EVENTS
      }
    }
  })
}

export const rejectProposal = async (proposalId: number): Promise<void> => {
  const client = await getSignClient()
  await client.reject({ id: proposalId, reason: getSdkError('USER_REJECTED') })
}

// CIP-103 wraps the signature in an object; bare strings get rejected.
export const respondWithSignMessage = async (topic: string, requestId: number, signatureBase64: string): Promise<void> => {
  const client = await getSignClient()
  await client.respond({ topic, response: formatJsonRpcResult(requestId, { signature: signatureBase64 }) })
}

export const respondWithResult = async <T>(topic: string, requestId: number, result: T): Promise<void> => {
  const client = await getSignClient()
  await client.respond({ topic, response: formatJsonRpcResult(requestId, result) })
}

export const respondWithError = async (topic: string, requestId: number, code: number, message: string): Promise<void> => {
  const client = await getSignClient()
  await client.respond({ topic, response: formatJsonRpcError(requestId, { code, message }) })
}

export const pairWithUri = async (uri: string): Promise<void> => {
  const client = await getSignClient()
  await client.core.pairing.pair({ uri })
}

export const disconnectAllSessions = async (): Promise<void> => {
  const client = await getSignClient()
  const sessions = client.session.getAll()
  await Promise.all(sessions.map(async s => {
    try {
      await client.disconnect({ topic: s.topic, reason: { code: 6000, message: 'wallet locked' } })
    } catch {
      // ignore
    }
  }))
}

export type ProposalEvent = SignClientTypes.EventArguments['session_proposal']
export type RequestEvent = SignClientTypes.EventArguments['session_request']

export const subscribeToProposals = async (cb: (e: ProposalEvent) => void): Promise<() => void> => {
  const client = await getSignClient()
  client.on('session_proposal', cb)
  return () => client.off('session_proposal', cb)
}

export const subscribeToRequests = async (cb: (e: RequestEvent) => void): Promise<() => void> => {
  const client = await getSignClient()
  client.on('session_request', cb)
  return () => client.off('session_request', cb)
}
