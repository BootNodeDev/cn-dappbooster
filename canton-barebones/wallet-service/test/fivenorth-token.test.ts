import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createFiveNorthTokenProvider } from '../src/fivenorthToken.ts'

describe('createFiveNorthTokenProvider', () => {
  it('caches the FiveNorth access token until the refresh window', async () => {
    // Scenario: wallet-service should not boot with an eight-hour static token.
    // It requests an OAuth token from FiveNorth, reuses it while valid, and asks
    // for a new one before the previous credential expires.
    const requests: Array<{ url: string; body: string }> = []
    const tokens = ['token-1', 'token-2']
    let currentTime = 1_000_000
    const provider = createFiveNorthTokenProvider(
      {
        tokenUrl: 'https://auth.sandbox.fivenorth.io/application/o/token/',
        clientId: 'validator-devnet-m2m',
        clientSecret: 'client-secret',
        scope: 'daml_ledger_api',
        refreshSkewMs: 60_000,
      },
      {
        now: () => currentTime,
        fetch: async (url, init) => {
          // The auth request must use client_credentials form encoding because
          // that is the FiveNorth machine-to-machine token contract.
          requests.push({ url: String(url), body: String(init?.body) })
          return new Response(
            JSON.stringify({
              access_token: tokens.shift(),
              token_type: 'Bearer',
              expires_in: 120,
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          )
        },
      },
    )

    // First call fetches a token and sends every OAuth field FiveNorth requires.
    assert.equal(await provider.getToken(), 'token-1')
    assert.equal(requests.length, 1)
    assert.equal(requests[0]?.url, 'https://auth.sandbox.fivenorth.io/application/o/token/')
    assert.equal(
      requests[0]?.body,
      'grant_type=client_credentials&client_id=validator-devnet-m2m&client_secret=client-secret&scope=daml_ledger_api',
    )

    // Still before the refresh window, the provider must reuse the cached token.
    currentTime += 30_000
    assert.equal(await provider.getToken(), 'token-1')
    assert.equal(requests.length, 1)

    // Inside the refresh window, the provider asks FiveNorth for a replacement.
    currentTime += 31_000
    assert.equal(await provider.getToken(), 'token-2')
    assert.equal(requests.length, 2)
  })
})
