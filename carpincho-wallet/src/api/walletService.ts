import { loadRuntimeConfig } from '@/config/runtimeConfig'

export interface JsonRpcErrorObject {
  code: number
  message: string
  data?: unknown
}

// Non-string messages would otherwise coerce to "[object Object]".
const coerceMessage = (message: unknown, code: number): string => {
  if (typeof message === 'string') {
    return message
  }
  try {
    return JSON.stringify(message) ?? `wallet-service error ${code}`
  } catch {
    return String(message)
  }
}

export class WalletServiceRpcError extends Error {
  code: number
  data?: unknown

  constructor(error: JsonRpcErrorObject) {
    super(coerceMessage(error.message, error.code))
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

type AdminRequestOptions = WalletServiceRequestOptions

const adminUrl = (path: string, options?: AdminRequestOptions): string => {
  const base = rpcUrl(options).replace(/\/rpc\/?$/, '')
  return `${base}${path}`
}

export const walletServiceAdminPost = async <TResult>(
  path: string,
  body: Record<string, unknown>,
  options?: AdminRequestOptions,
): Promise<TResult> => {
  const response = await fetch(adminUrl(path, options), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`wallet-service HTTP ${response.status}${text === '' ? '' : `: ${text}`}`)
  }
  return (await response.json()) as TResult
}

export const prepareCreateParty = async (
  body: { publicKeyBase64: string; partyHint: string },
  options?: AdminRequestOptions,
): Promise<{ onboardingId: string; partyId: string; multiHash: string }> =>
  await walletServiceAdminPost('/admin/party/prepare', body, options)

export const completeCreateParty = async (
  body: { onboardingId: string; signatureBase64: string; expectHeavyLoad?: boolean },
  options?: AdminRequestOptions,
): Promise<{ partyId: string }> =>
  await walletServiceAdminPost('/admin/party/complete', body, options)
