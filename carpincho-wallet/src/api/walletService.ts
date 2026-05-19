import { loadRuntimeConfig } from '@/config/runtimeConfig.ts'

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

export class WalletServiceRpcError extends Error {
  code: number
  data?: unknown

  constructor(error: JsonRpcErrorObject) {
    super(error.message)
    this.name = 'WalletServiceRpcError'
    this.code = error.code
    this.data = error.data
  }
}

export interface WalletServiceRequestOptions {
  rpcUrl?: string
}

const rpcUrl = (options?: WalletServiceRequestOptions): string =>
  options?.rpcUrl?.trim() === undefined || options.rpcUrl.trim() === ''
    ? loadRuntimeConfig().walletServiceRpcUrl
    : options.rpcUrl.trim()

export const walletServiceRequest = async <T>(
  method: string,
  params?: unknown,
  options?: WalletServiceRequestOptions,
): Promise<T> => {
  const response = await fetch(rpcUrl(options), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      ...(params === undefined ? {} : { params }),
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`wallet-service HTTP ${response.status}${body === '' ? '' : `: ${body}`}`)
  }

  const payload = (await response.json()) as {
    result?: T
    error?: JsonRpcErrorObject
  }
  if (payload.error !== undefined) {
    throw new WalletServiceRpcError(payload.error)
  }
  return payload.result as T
}
