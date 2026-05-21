import type { Provider } from '@canton-network/core-splice-provider'
import type { RpcTypes as DappRpcTypes } from '@canton-network/core-wallet-dapp-rpc-client'

export const CARPINCHO_EXTENSION_TARGET = 'carpincho-wallet'

export interface ExtensionWalletAdapter {
  detect: () => Promise<boolean>
  provider: () => Provider<DappRpcTypes>
}

export interface ExtensionWalletProviderOptions {
  adapterFactory?: () => ExtensionWalletAdapter | Promise<ExtensionWalletAdapter>
}

const defaultExtensionAdapter = async (): Promise<ExtensionWalletAdapter> => {
  const { ExtensionAdapter } = await import('@canton-network/dapp-sdk')
  return new ExtensionAdapter({
    providerId: `browser:ext:${CARPINCHO_EXTENSION_TARGET}`,
    name: 'Carpincho Wallet',
    description: 'Connect with the Carpincho browser extension wallet',
    target: CARPINCHO_EXTENSION_TARGET
  })
}

// SPLICE_WALLET_EVENT is Carpincho's extension to the canonical SPLICE_WALLET
// protocol — see carpincho-wallet/src/extension/messages.ts. The canonical
// extension transport (WindowTransport) carries request/response only; this
// listener bridges wallet-pushed events onto the Provider's emitter so
// `client.onAccountsChanged(listener)` from @canton-network/dapp-sdk fires.
const SPLICE_WALLET_EVENT_TYPE = 'SPLICE_WALLET_EVENT'

interface SpliceWalletEventMessage {
  type: typeof SPLICE_WALLET_EVENT_TYPE
  eventName: string
  payload: unknown
  target?: string
}

const isSpliceWalletEvent = (data: unknown): data is SpliceWalletEventMessage =>
  typeof data === 'object' &&
  data !== null &&
  (data as { type?: unknown }).type === SPLICE_WALLET_EVENT_TYPE &&
  typeof (data as { eventName?: unknown }).eventName === 'string'

const wireEventBridge = (provider: Provider<DappRpcTypes>): void => {
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return
    }
    const data = event.data as unknown
    if (!isSpliceWalletEvent(data)) {
      return
    }
    if (data.target !== undefined && data.target !== CARPINCHO_EXTENSION_TARGET) {
      return
    }
    provider.emit(data.eventName, data.payload)
  })
}

export const createExtensionWalletProvider = async (
  options: ExtensionWalletProviderOptions = {}
): Promise<Provider<DappRpcTypes> | undefined> => {
  const adapter = options.adapterFactory === undefined
    ? await defaultExtensionAdapter()
    : await options.adapterFactory()
  if (!(await adapter.detect())) {
    return undefined
  }
  const provider = adapter.provider()
  wireEventBridge(provider)
  return provider
}
