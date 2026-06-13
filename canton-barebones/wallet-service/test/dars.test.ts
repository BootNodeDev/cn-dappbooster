import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { createDarUploadApi } from '../src/dars.ts'
import { InvalidParams } from '../src/rpc.ts'

// Mirrors the FiveNorth runtime shape without depending on local environment variables.
const baseConfig = () => ({
  port: 3010,
  corsOrigins: ['http://localhost:3011'],
  network: 'canton:fivenorth-devnet',
  provider: {
    id: 'wallet-service',
    version: '0.1.0',
    url: 'http://localhost:3010',
    userUrl: 'http://localhost:3010',
  },
  canton: {
    jsonApiUrl: 'https://ledger.example',
    ledgerApiUrl: 'https://ledger.example',
    adminApiUrl: '',
    tokenSource: 'fivenorth' as const,
  },
  splice: {
    validatorUrl: 'https://validator.example/api/validator',
    registryApiUrl: 'https://validator.example/api/validator/v0/scan-proxy',
  },
})

describe('DAR upload proxy', () => {
  it('posts the raw DAR bytes to the ledger JSON API with vetting enabled', async () => {
    // Scenario: Carpincho sends a compiled DAR file to wallet-service, and the
    // service must keep the bearer token boundary while enabling vetting by default.
    const darBytes = Buffer.from('dar-bytes')
    const seen: { url?: string; auth?: string; type?: string; body?: string } = {}
    const api = createDarUploadApi(baseConfig(), {
      tokenProvider: { getToken: async () => 'ledger-token' },
      fetch: async (input, init) => {
        // Capture the proxied participant request so the endpoint shape stays stable.
        seen.url = String(input)
        seen.auth = new Headers(init?.headers).get('authorization') ?? undefined
        seen.type = new Headers(init?.headers).get('content-type') ?? undefined
        seen.body = Buffer.from(init?.body as ArrayBuffer).toString()
        return new Response(JSON.stringify({ packageIds: ['pkg-1'] }), { status: 200 })
      },
    })

    const result = await api.upload(darBytes)

    // The participant receives exactly the uploaded bytes and the fixed vetting flag.
    assert.equal(seen.url, 'https://ledger.example/v2/dars?vetAllPackages=true')
    assert.equal(seen.auth, 'Bearer ledger-token')
    assert.equal(seen.type, 'application/octet-stream')
    assert.equal(seen.body, 'dar-bytes')
    assert.deepEqual(result, {
      ok: true,
      vetAllPackages: true,
      response: { packageIds: ['pkg-1'] },
    })
  })

  it('rejects empty DAR uploads before calling the ledger API', async () => {
    // Scenario: an empty browser upload is a client error, not a ledger failure.
    let called = false
    const api = createDarUploadApi(baseConfig(), {
      tokenProvider: { getToken: async () => 'ledger-token' },
      fetch: async () => {
        called = true
        return new Response('{}', { status: 200 })
      },
    })

    await assert.rejects(() => api.upload(Buffer.alloc(0)), InvalidParams)

    // The participant must not receive malformed package upload requests.
    assert.equal(called, false)
  })
})
