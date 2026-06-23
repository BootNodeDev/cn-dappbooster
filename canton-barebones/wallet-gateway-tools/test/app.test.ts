import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { after, describe, it } from 'node:test'
import { createWalletGatewayToolsApp } from '../src/app.ts'
import type { WalletGatewayToolsConfig } from '../src/config.ts'

const servers: http.Server[] = []

// The test closes every ephemeral HTTP server so repeated runs do not leak ports.
after(async () => {
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error === undefined) {
              resolve()
              return
            }
            reject(error)
          })
        }),
    ),
  )
})

// Builds the smallest real-mode config needed by the Express app factory.
const config = (upstreamUrl: string): WalletGatewayToolsConfig => ({
  port: 3010,
  corsOrigins: ['http://localhost:3011'],
  network: 'canton:localnet',
  provider: {
    id: 'wallet-gateway-tools',
    version: '0.1.0',
    url: 'http://localhost:3010',
    userUrl: 'http://localhost:3010',
  },
  canton: {
    jsonApiUrl: 'http://localhost:2975',
    ledgerApiUrl: 'grpc://localhost:2901',
    adminApiUrl: 'grpc://localhost:2902',
    auth: { mode: 'static-token', token: 'local-token' },
  },
  splice: {
    validatorUrl: 'http://localhost:2000/api/validator',
    scanApiUrl: 'http://localhost:4000/api/scan',
    registryApiUrl: 'http://localhost:2000/api/validator/v0/scan-proxy',
  },
  walletGateway: {
    upstreamUrl,
  },
})

// Starts a server on an ephemeral port and returns its host URL.
const listen = async (server: http.Server): Promise<string> => {
  servers.push(server)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

describe('wallet-gateway facade proxy', () => {
  it('reports the tools service identity on the local health endpoint', async () => {
    // Scenario: operators and container probes check the public facade URL. The
    // response should name the selected gateway service, not the old bridge name.
    const facadeUrl = await listen(
      http.createServer(createWalletGatewayToolsApp(config('http://127.0.0.1:9'))),
    )

    // Action: read the local health endpoint that is owned by the tools facade.
    const response = await fetch(`${facadeUrl}/health`)
    const body = (await response.json()) as { ok: boolean; service: string }

    // Expected result: health confirms the tools service that users selected.
    assert.equal(response.status, 200)
    assert.deepEqual(body, {
      ok: true,
      service: 'wallet-gateway-tools',
      network: 'canton:localnet',
    })
  })

  it('forwards standard wallet-gateway requests to the configured upstream', async () => {
    // Scenario: tools mode exposes one public service. Requests for the
    // official wallet-gateway API must pass through unchanged so existing
    // wallet-gateway consumers can point at the tools facade URL.
    let seen: { url?: string; method?: string; body?: string } = {}
    const upstreamUrl = await listen(
      http.createServer((req, res) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk))
        })
        req.on('end', () => {
          seen = {
            url: req.url,
            method: req.method,
            body: Buffer.concat(chunks).toString('utf8'),
          }
          res.writeHead(200, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ ok: true, source: 'wallet-gateway' }))
        })
      }),
    )
    const facadeUrl = await listen(
      http.createServer(createWalletGatewayToolsApp(config(upstreamUrl))),
    )

    // Action: send a representative JSON-RPC call to the upstream dApp path
    // through the facade, preserving the URL, method, headers, and body.
    const response = await fetch(`${facadeUrl}/api/v0/dapp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'status', id: 1 }),
    })
    const body = (await response.json()) as { ok: boolean; source: string }

    // Expected result: the upstream wallet-gateway receives the original
    // request body and the browser receives the upstream response.
    assert.equal(response.status, 200)
    assert.deepEqual(body, { ok: true, source: 'wallet-gateway' })
    assert.equal(seen.url, '/api/v0/dapp')
    assert.equal(seen.method, 'POST')
    assert.equal(seen.body, JSON.stringify({ jsonrpc: '2.0', method: 'status', id: 1 }))
  })
})
