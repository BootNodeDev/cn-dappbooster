import { SDK } from '@canton-network/wallet-sdk'
import type { WalletServiceConfig } from '../config.js'

export type WalletSdk = Awaited<ReturnType<typeof SDK.create>>

export type WalletSdkService = {
  getSdk: () => Promise<WalletSdk>
}

export const createWalletSdkService = (config: WalletServiceConfig): WalletSdkService => {
  let sdkPromise: Promise<WalletSdk> | undefined

  const getSdk = async (): Promise<WalletSdk> => {
    if (config.canton.backendToken === undefined) {
      throw new Error('CANTON_BACKEND_TOKEN is required for Canton JSON API calls')
    }
    sdkPromise ??= SDK.create({
        auth: { method: 'static', token: config.canton.backendToken },
        ledgerClientUrl: config.canton.jsonApiUrl,
        logAdapter: 'console'
      })
      .catch((error: unknown) => {
        sdkPromise = undefined
        throw new Error('Canton wallet SDK failed to initialize', { cause: error })
      })
    return await sdkPromise
  }

  return { getSdk }
}
