import cors from 'cors'
import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import type { WalletGatewayDevkitConfig } from './config.ts'
import { createPartyApi } from './party.ts'
import { createRpc, InvalidParams } from './rpc.ts'
import type { JsonRpcRequest, JsonRpcResponse } from './types.ts'

// Builds the HTTP app so tests can exercise routing without binding a fixed port.
export const createWalletGatewayDevkitApp = (
  config: WalletGatewayDevkitConfig,
): express.Express => {
  const rpc = createRpc(config)
  const adminParty = createPartyApi(config, { getSdk: () => rpc.getSdk() })
  const app = express()
  const jsonBody = express.json({ limit: '1mb' })

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
    }),
  )

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'wallet-gateway-devkit',
      network: config.network,
    })
  })

  app.get('/devkit/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'wallet-gateway-devkit',
      network: config.network,
    })
  })

  app.get('/devkit/info', (_req, res) => {
    res.json(rpc.serviceInfo())
  })

  // Keeps older diagnostics clients working while docs move to /devkit/info.
  app.get('/wallet-service/info', (_req, res) => {
    res.json(rpc.serviceInfo())
  })

  // Converts expected devkit validation failures into client errors.
  const handleAdminError = (res: express.Response, error: unknown): void => {
    if (error instanceof InvalidParams) {
      res.status(400).json({ error: error.message })
      return
    }
    console.error('[wallet-gateway-devkit] admin failed', error)
    res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
  }

  app.post('/admin/party/prepare', jsonBody, async (req, res) => {
    const body = req.body as { publicKeyBase64?: string; partyHint?: string }
    try {
      res.json(await adminParty.prepare(body))
    } catch (error) {
      handleAdminError(res, error)
    }
  })

  app.post('/admin/party/complete', jsonBody, async (req, res) => {
    const body = req.body as {
      onboardingId?: string
      signatureBase64?: string
      expectHeavyLoad?: boolean
    }
    try {
      res.json(await adminParty.complete(body))
    } catch (error) {
      handleAdminError(res, error)
    }
  })

  app.post('/rpc', jsonBody, async (req, res) => {
    const body = req.body as unknown
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      const response: JsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32600,
          message: 'Invalid request',
          data: { reason: 'JSON-RPC body must be an object' },
        },
      }
      res.json(response)
      return
    }
    const response = await rpc.handle(body as JsonRpcRequest)
    if (response === undefined) {
      res.status(204).end()
      return
    }
    res.json(response)
  })

  if (config.walletGateway?.upstreamUrl !== undefined) {
    app.use(
      createProxyMiddleware({
        target: config.walletGateway.upstreamUrl,
        changeOrigin: true,
        ws: true,
      }),
    )
  }

  return app
}
