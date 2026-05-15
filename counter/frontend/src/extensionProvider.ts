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

export const createExtensionWalletProvider = async (
  options: ExtensionWalletProviderOptions = {}
): Promise<Provider<DappRpcTypes> | undefined> => {
  const adapter = options.adapterFactory === undefined
    ? await defaultExtensionAdapter()
    : await options.adapterFactory()
  return await adapter.detect() ? adapter.provider() : undefined
}
