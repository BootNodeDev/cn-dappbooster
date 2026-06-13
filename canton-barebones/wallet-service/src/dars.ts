import type { WalletServiceConfig } from './config.ts'
import { type CantonTokenProvider, createFiveNorthTokenProvider } from './fivenorthToken.ts'
import { InvalidParams } from './rpc.ts'

export interface DarUploadResult {
  ok: true
  vetAllPackages: true
  response: unknown
}

export interface DarUploadApi {
  upload: (bytes: Buffer) => Promise<DarUploadResult>
}

interface DarUploadDeps {
  fetch?: typeof fetch
  tokenProvider?: CantonTokenProvider
}

// Keeps package vetting coupled to the dev upload endpoint so Carpincho has no ledger policy knobs.
const darUploadUrl = (config: WalletServiceConfig): string =>
  `${config.canton.jsonApiUrl.replace(/\/$/, '')}/v2/dars?vetAllPackages=true`

// Preserves non-JSON ledger responses for debugging while parsing normal JSON API success bodies.
const parseLedgerResponse = (text: string): unknown => {
  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return text
  }
}

// Proxies compiled DAR bytes to the participant JSON API without exposing bearer tokens to Carpincho.
export const createDarUploadApi = (
  config: WalletServiceConfig,
  deps: DarUploadDeps = {},
): DarUploadApi => {
  const fetchImpl = deps.fetch ?? fetch
  const tokenProvider =
    deps.tokenProvider ??
    (config.canton.auth === undefined
      ? undefined
      : createFiveNorthTokenProvider(config.canton.auth, { fetch: fetchImpl }))

  return {
    upload: async (bytes) => {
      if (bytes.length === 0) {
        throw new InvalidParams('DAR file is required')
      }
      if (tokenProvider === undefined) {
        throw new Error('FIVENORTH_CLIENT_SECRET is required for DAR upload')
      }
      const token = await tokenProvider.getToken()
      const body = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer
      const response = await fetchImpl(darUploadUrl(config), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/octet-stream',
        },
        body,
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(`DAR upload failed with HTTP ${response.status}: ${text}`)
      }
      return {
        ok: true,
        vetAllPackages: true,
        response: parseLedgerResponse(text),
      }
    },
  }
}

// Mock mode validates the browser path without making participant mutations.
export const createMockDarUploadApi = (): DarUploadApi => ({
  upload: async (bytes) => {
    if (bytes.length === 0) {
      throw new InvalidParams('DAR file is required')
    }
    return { ok: true, vetAllPackages: true, response: { mock: true, size: bytes.length } }
  },
})
