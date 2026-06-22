import { createCantonToken } from './canton-token.ts'

export type CantonAuthMode = 'none' | 'static-token' | 'self-signed' | 'oauth-client-credentials'

export type CantonAuthConfig =
  | { mode: 'none' }
  | { mode: 'static-token'; token: string }
  | { mode: 'self-signed'; subject: string; audience: string; secret: string }
  | {
      mode: 'oauth-client-credentials'
      tokenUrl: string
      clientId: string
      clientSecret: string
      scope?: string
    }

export type AuthProvider = {
  mode: CantonAuthMode
  getToken: () => Promise<string>
}

type AuthProviderDeps = {
  fetch?: typeof fetch
  now?: () => Date
}

const OAUTH_REFRESH_SKEW_MS = 30_000

// Creates the runtime bearer-token provider used by all Canton SDK and JSON API calls.
export const createAuthProvider = (
  config: CantonAuthConfig,
  deps: AuthProviderDeps = {},
): AuthProvider => {
  switch (config.mode) {
    case 'none':
      return {
        mode: 'none',
        getToken: async () => {
          throw new Error('Canton auth is disabled')
        },
      }
    case 'static-token':
      return {
        mode: 'static-token',
        getToken: async () => config.token,
      }
    case 'self-signed': {
      const token = createCantonToken(config)
      return {
        mode: 'self-signed',
        getToken: async () => token,
      }
    }
    case 'oauth-client-credentials':
      return createOauthAuthProvider(config, deps)
  }
}

// Exchanges client credentials for a bearer token and refreshes before expiry.
const createOauthAuthProvider = (
  config: Extract<CantonAuthConfig, { mode: 'oauth-client-credentials' }>,
  deps: AuthProviderDeps,
): AuthProvider => {
  const fetchImpl = deps.fetch ?? fetch
  const now = deps.now ?? (() => new Date())
  let cached: { token: string; expiresAt: number } | undefined
  let pending: Promise<string> | undefined

  const isFresh = (): boolean =>
    cached !== undefined && now().getTime() < cached.expiresAt - OAUTH_REFRESH_SKEW_MS

  const requestToken = async (): Promise<string> => {
    const body = new URLSearchParams()
    body.set('grant_type', 'client_credentials')
    body.set('client_id', config.clientId)
    body.set('client_secret', config.clientSecret)
    if (config.scope !== undefined) {
      body.set('scope', config.scope)
    }

    const response = await fetchImpl(config.tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`OAuth token request failed with HTTP ${response.status}: ${text}`)
    }
    const payload = parseOAuthPayload(text)
    const expiresInMs = payload.expiresInSeconds * 1000
    cached = {
      token: payload.accessToken,
      expiresAt: now().getTime() + expiresInMs,
    }
    return payload.accessToken
  }

  return {
    mode: 'oauth-client-credentials',
    getToken: async () => {
      if (isFresh()) {
        return cached!.token
      }
      pending ??= requestToken().finally(() => {
        pending = undefined
      })
      return await pending
    },
  }
}

// Parses only the OAuth fields devkit needs and rejects malformed token responses early.
const parseOAuthPayload = (text: string): { accessToken: string; expiresInSeconds: number } => {
  const value = JSON.parse(text) as { access_token?: unknown; expires_in?: unknown }
  if (typeof value.access_token !== 'string' || value.access_token.trim() === '') {
    throw new Error('OAuth token response did not include access_token')
  }
  const expiresInSeconds =
    typeof value.expires_in === 'number' && value.expires_in > 0 ? value.expires_in : 0
  return { accessToken: value.access_token, expiresInSeconds }
}
