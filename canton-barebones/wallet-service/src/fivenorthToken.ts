export interface FiveNorthAuthConfig {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope: string
  refreshSkewMs: number
}

export interface CantonTokenProvider {
  getToken: () => Promise<string>
}

type FiveNorthTokenProviderDeps = {
  fetch?: typeof fetch
  now?: () => number
}

type FiveNorthTokenResponse = {
  access_token?: string
  expires_in?: number
}

// Converts the client credentials into the exact form body required by FiveNorth OAuth.
const tokenRequestBody = (config: FiveNorthAuthConfig): URLSearchParams => {
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)
  body.set('scope', config.scope)
  return body
}

// Parses the OAuth response and rejects malformed credentials before the SDK sees them.
const readTokenResponse = async (response: Response): Promise<FiveNorthTokenResponse> => {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`FiveNorth token request failed with HTTP ${response.status}: ${text}`)
  }
  const parsed = JSON.parse(text) as FiveNorthTokenResponse
  if (typeof parsed.access_token !== 'string' || parsed.access_token.trim() === '') {
    throw new Error('FiveNorth token response did not include access_token')
  }
  if (typeof parsed.expires_in !== 'number' || parsed.expires_in <= 0) {
    throw new Error('FiveNorth token response did not include a positive expires_in')
  }
  return parsed
}

// Fetches and caches FiveNorth access tokens so wallet-service never depends on a pasted JWT.
export const createFiveNorthTokenProvider = (
  config: FiveNorthAuthConfig,
  deps: FiveNorthTokenProviderDeps = {},
): CantonTokenProvider => {
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? (() => Date.now())
  let cached: { token: string; refreshAt: number } | undefined

  return {
    getToken: async () => {
      const current = now()
      if (cached !== undefined && current < cached.refreshAt) {
        return cached.token
      }
      const response = await fetchImpl(config.tokenUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: tokenRequestBody(config),
      })
      const parsed = await readTokenResponse(response)
      const expiresInMs = parsed.expires_in! * 1000
      cached = {
        token: parsed.access_token!,
        refreshAt: current + Math.max(0, expiresInMs - config.refreshSkewMs),
      }
      return cached.token
    },
  }
}
