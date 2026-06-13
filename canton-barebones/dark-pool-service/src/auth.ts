// Bearer-token providers: a static LocalNet token, a FiveNorth M2M token
// (cached, refresh-ahead), and a no-op for mock mode.

export interface TokenProvider {
  getToken: () => Promise<string>
}

export interface M2mAuthConfig {
  tokenUrl: string
  clientId: string
  clientSecret: string
  scope: string
  refreshSkewMs: number
}

export const staticToken = (token: string): TokenProvider => ({
  getToken: async () => token,
})

export const noToken = (): TokenProvider => ({
  getToken: async () => '',
})

type M2mDeps = { fetch?: typeof fetch; now?: () => number }
type M2mResponse = { access_token?: string; expires_in?: number }

const requestBody = (config: M2mAuthConfig): URLSearchParams => {
  const body = new URLSearchParams()
  body.set('grant_type', 'client_credentials')
  body.set('client_id', config.clientId)
  body.set('client_secret', config.clientSecret)
  body.set('scope', config.scope)
  return body
}

const readResponse = async (response: Response): Promise<M2mResponse> => {
  const text = await response.text()
  if (!response.ok) {
    throw new Error(`M2M token request failed with HTTP ${response.status}: ${text}`)
  }
  const parsed = JSON.parse(text) as M2mResponse
  if (typeof parsed.access_token !== 'string' || parsed.access_token.trim() === '') {
    throw new Error('M2M token response did not include access_token')
  }
  if (typeof parsed.expires_in !== 'number' || parsed.expires_in <= 0) {
    throw new Error('M2M token response did not include a positive expires_in')
  }
  return parsed
}

// Fetches and caches FiveNorth access tokens, refreshing ahead of expiry.
export const m2mToken = (config: M2mAuthConfig, deps: M2mDeps = {}): TokenProvider => {
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
        body: requestBody(config),
      })
      const parsed = await readResponse(response)
      const expiresInMs = (parsed.expires_in ?? 0) * 1000
      cached = {
        token: parsed.access_token ?? '',
        refreshAt: current + Math.max(0, expiresInMs - config.refreshSkewMs),
      }
      return cached.token
    },
  }
}
