import { strict as assert } from 'node:assert'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, describe, it } from 'node:test'
import { createWalletServiceApp } from '../src/app.ts'

// Builds the ephemeral server URL used by HTTP-level route assertions.
const serverUrl = (server: Server): string => {
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

// Provides only the config fields the app needs so route tests stay isolated from env loading.
const baseConfig = () => ({
  port: 3010,
  corsOrigins: ['*'],
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

describe('wallet-service app', () => {
  it('accepts octet-stream DAR uploads through the admin route', async () => {
    // Scenario: the browser sends a compiled DAR file as bytes, and the Express
    // route must preserve those bytes instead of trying to parse JSON.
    const seen: { bytes?: string } = {}
    const app = createWalletServiceApp({
      config: baseConfig(),
      mockEnabled: false,
      rpc: {
        handle: async () => undefined,
        serviceInfo: () => ({}),
        getSdk: async () => {
          throw new Error('not used')
        },
      },
      adminParty: {
        prepare: async () => ({}),
        complete: async () => ({}),
        pendingSize: () => 0,
      },
      darApi: {
        upload: async (bytes) => {
          seen.bytes = bytes.toString()
          return { ok: true, vetAllPackages: true, response: {} }
        },
      },
    })
    const server = app.listen(0)
    after(() => server.close())

    const response = await fetch(`${serverUrl(server)}/admin/dars`, {
      method: 'POST',
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from('dar-bytes'),
    })

    // The route returns the upload result and forwards the unmodified payload.
    assert.equal(response.status, 200)
    assert.equal(seen.bytes, 'dar-bytes')
    assert.deepEqual(await response.json(), { ok: true, vetAllPackages: true, response: {} })
  })
})
