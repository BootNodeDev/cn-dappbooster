import SignClient from '@walletconnect/sign-client'
import type { RequestArgs } from '@canton-network/core-types'
import type { EventListener, Provider } from '@canton-network/core-splice-provider'
import type {
  RpcTypes as DappRpcTypes,
  StatusEvent
} from '@canton-network/core-wallet-dapp-rpc-client'

const CANTON_NAMESPACE = 'canton'
const CANTON_WC_METHODS = [
  'canton_prepareSignExecute',
  'canton_listAccounts',
  'canton_getPrimaryAccount',
  'canton_getActiveNetwork',
  'canton_status',
  'canton_ledgerApi',
  'canton_signMessage'
]
const CANTON_WC_EVENTS = ['accountsChanged', 'statusChanged']

const PROVIDER_INFO = {
  id: 'walletconnect',
  providerType: 'mobile' as const
}

export interface WalletConnectSession {
  topic: string
}

export interface WalletConnectSignClient {
  connect: (args: {
    requiredNamespaces: Record<string, {
      chains: string[]
      methods: string[]
      events: string[]
    }>
  }) => Promise<{
    uri?: string
    approval: () => Promise<WalletConnectSession>
  }>
  request: (args: {
    topic: string
    chainId: string
    request: {
      method: string
      params: unknown
    }
  }) => Promise<unknown>
  disconnect: (args: {
    topic: string
    reason: { code: number; message: string }
  }) => Promise<void>
  on: (event: string, listener: (event: {
    params: {
      event: {
        name: string
        data: unknown
      }
    }
  }) => void) => unknown
  session: {
    getAll: () => WalletConnectSession[]
  }
}

export interface WalletConnectProviderConfig {
  projectId: string
  chainId: string
  metadata: {
    name: string
    description: string
    url: string
    icons: string[]
  }
  onUri: (uri: string) => void
  signClientFactory?: () => Promise<WalletConnectSignClient>
}

class CopyUriWalletConnectProvider implements Provider<DappRpcTypes> {
  private readonly listeners: Record<string, Array<EventListener<unknown>>> = {}
  private signClient: WalletConnectSignClient | undefined
  private signClientPromise: Promise<WalletConnectSignClient> | undefined
  private session: WalletConnectSession | undefined
  private sessionEventsAttached = false

  constructor(private readonly config: WalletConnectProviderConfig) {}

  async request<M extends keyof DappRpcTypes>(args: RequestArgs<DappRpcTypes, M>): Promise<DappRpcTypes[M]['result']> {
    if (args.method === 'connect') {
      if (this.session === undefined) {
        await this.establishSession()
      }
      const status = this.connectedStatus()
      this.emit('statusChanged', status)
      return status.connection as DappRpcTypes[M]['result']
    }

    if (args.method === 'disconnect') {
      await this.disconnectSession()
      this.emitDisconnected('User disconnected')
      return null as DappRpcTypes[M]['result']
    }

    if (args.method === 'status' && this.session === undefined) {
      return {
        provider: PROVIDER_INFO,
        connection: {
          isConnected: false,
          isNetworkConnected: false
        }
      } as DappRpcTypes[M]['result']
    }

    if (this.session === undefined) {
      throw new Error('WalletConnect session not established')
    }

    if (args.method === 'prepareExecute' || args.method === 'prepareExecuteAndWait') {
      const result = await this.walletConnectRequest('prepareSignExecute', paramsOf(args))
      this.emit('txChanged', result)
      return { tx: result } as DappRpcTypes[M]['result']
    }

    return await this.walletConnectRequest(args.method, paramsOf(args)) as DappRpcTypes[M]['result']
  }

  on<E>(event: string, listener: EventListener<E>): Provider<DappRpcTypes> {
    this.listeners[event] ??= []
    this.listeners[event].push(listener as EventListener<unknown>)
    return this
  }

  emit<E>(event: string, ...args: E[]): boolean {
    const listeners = this.listeners[event]
    if (listeners === undefined) {
      return false
    }
    listeners.forEach(listener => listener(...args))
    return true
  }

  removeListener<E>(event: string, listenerToRemove: EventListener<E>): Provider<DappRpcTypes> {
    const listeners = this.listeners[event]
    if (listeners === undefined) {
      return this
    }
    this.listeners[event] = listeners.filter(listener => listener !== listenerToRemove)
    return this
  }

  private async initSignClient(): Promise<WalletConnectSignClient> {
    if (this.signClient !== undefined) {
      return this.signClient
    }
    this.signClientPromise ??= this.createSignClient()
    this.signClient = await this.signClientPromise
    return this.signClient
  }

  private async createSignClient(): Promise<WalletConnectSignClient> {
    if (this.config.signClientFactory !== undefined) {
      return await this.config.signClientFactory()
    }
    return await SignClient.init({
      projectId: this.config.projectId,
      metadata: this.config.metadata
    }) as WalletConnectSignClient
  }

  private async establishSession(): Promise<void> {
    const client = await this.initSignClient()
    const { uri, approval } = await client.connect({
      requiredNamespaces: {
        [CANTON_NAMESPACE]: {
          chains: [this.config.chainId],
          methods: CANTON_WC_METHODS,
          events: CANTON_WC_EVENTS
        }
      }
    })
    if (uri !== undefined) {
      this.config.onUri(uri)
    }
    this.session = await approval()
    this.setupSessionEvents(client)
  }

  private setupSessionEvents(client: WalletConnectSignClient): void {
    if (this.sessionEventsAttached) {
      return
    }
    this.sessionEventsAttached = true
    client.on('session_event', event => {
      const { name, data } = event.params.event
      this.emit(name, data)
    })
  }

  private async walletConnectRequest(method: string, params: unknown): Promise<unknown> {
    if (this.session === undefined) {
      throw new Error('WalletConnect session not established')
    }
    const client = await this.initSignClient()
    try {
      return await client.request({
        topic: this.session.topic,
        chainId: this.config.chainId,
        request: {
          method: `canton_${method}`,
          params: params ?? {}
        }
      })
    } catch (error) {
      const errorRecord = typeof error === 'object' && error !== null ? error : {}
      const code = 'code' in errorRecord ? errorRecord.code : -32603
      const message = error instanceof Error
        ? error.message
        : 'message' in errorRecord && typeof errorRecord.message === 'string'
          ? errorRecord.message
          : String(error)
      throw new Error(`RPC error: ${String(code)} - ${message}`, { cause: error })
    }
  }

  private async disconnectSession(): Promise<void> {
    if (this.signClient === undefined || this.session === undefined) {
      this.session = undefined
      return
    }
    try {
      await this.signClient.disconnect({
        topic: this.session.topic,
        reason: { code: 6000, message: 'User disconnected' }
      })
    } catch {
      // WalletConnect sessions can already be gone locally or remotely.
    } finally {
      this.session = undefined
    }
  }

  private connectedStatus(): StatusEvent {
    return {
      provider: PROVIDER_INFO,
      connection: {
        isConnected: true,
        isNetworkConnected: true
      }
    }
  }

  private emitDisconnected(reason: string): void {
    this.emit('statusChanged', {
      provider: PROVIDER_INFO,
      connection: {
        isConnected: false,
        isNetworkConnected: false,
        reason
      }
    })
  }
}

const paramsOf = <M extends keyof DappRpcTypes>(args: RequestArgs<DappRpcTypes, M>): unknown =>
  'params' in args ? args.params : undefined

export const createWalletConnectProvider = (config: WalletConnectProviderConfig): Provider<DappRpcTypes> =>
  new CopyUriWalletConnectProvider(config)
