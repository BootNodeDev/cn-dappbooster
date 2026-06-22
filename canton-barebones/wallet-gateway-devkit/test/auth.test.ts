import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createAuthProvider } from '../src/auth.ts'
import { createCantonToken } from '../src/canton-token.ts'

describe('auth provider', () => {
  it('returns the configured static bearer token without extra work', async () => {
    // Scenario: operators can paste a JWT obtained outside devkit. The service
    // should pass that token through without trying to inspect or refresh it.
    const auth = createAuthProvider({
      mode: 'static-token',
      token: 'static.jwt',
    })

    assert.equal(await auth.getToken(), 'static.jwt')
  })

  it('mints a LocalNet self-signed token from the configured signing recipe', async () => {
    // Scenario: local Splice uses the unsafe self-signed auth recipe. Devkit can
    // derive the same token shape as the standalone token script at startup.
    const auth = createAuthProvider({
      mode: 'self-signed',
      subject: 'ledger-api-user',
      audience: 'https://canton.network.global',
      secret: 'unsafe',
    })

    assert.equal(
      await auth.getToken(),
      createCantonToken({
        subject: 'ledger-api-user',
        audience: 'https://canton.network.global',
        secret: 'unsafe',
      }),
    )
  })

  it('fetches and reuses an OAuth client-credentials token until it is near expiry', async () => {
    // Scenario: DevNet/TestNet deployments give devkit an OAuth client instead
    // of a pre-generated JWT. Devkit should exchange it once and cache the
    // bearer token while it is still safely valid.
    const requests: string[] = []
    const auth = createAuthProvider(
      {
        mode: 'oauth-client-credentials',
        tokenUrl: 'https://auth.example/token',
        clientId: 'devkit-client',
        clientSecret: 'devkit-secret',
        scope: 'daml_ledger_api',
      },
      {
        now: () => new Date('2026-06-22T12:00:00Z'),
        fetch: async (url, init) => {
          requests.push(`${url} ${init?.body}`)
          return new Response(JSON.stringify({ access_token: 'oauth.jwt', expires_in: 3600 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      },
    )

    assert.equal(await auth.getToken(), 'oauth.jwt')
    assert.equal(await auth.getToken(), 'oauth.jwt')
    assert.deepEqual(requests, [
      'https://auth.example/token grant_type=client_credentials&client_id=devkit-client&client_secret=devkit-secret&scope=daml_ledger_api',
    ])
  })

  it('refreshes an OAuth token when the cached token is near expiry', async () => {
    // Scenario: SDK helpers can run for longer than one access token lifetime.
    // The auth layer must fetch a replacement before reusing a stale token.
    let now = new Date('2026-06-22T12:00:00Z')
    const issued: string[] = []
    const auth = createAuthProvider(
      {
        mode: 'oauth-client-credentials',
        tokenUrl: 'https://auth.example/token',
        clientId: 'devkit-client',
        clientSecret: 'devkit-secret',
      },
      {
        now: () => now,
        fetch: async () => {
          const token = `oauth-${issued.length + 1}.jwt`
          issued.push(token)
          return new Response(JSON.stringify({ access_token: token, expires_in: 60 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
        },
      },
    )

    assert.equal(await auth.getToken(), 'oauth-1.jwt')
    now = new Date('2026-06-22T12:00:31Z')
    assert.equal(await auth.getToken(), 'oauth-2.jwt')
    assert.deepEqual(issued, ['oauth-1.jwt', 'oauth-2.jwt'])
  })
})
