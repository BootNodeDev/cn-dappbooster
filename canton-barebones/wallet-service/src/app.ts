import cors from 'cors'
import express from 'express'
import type { WalletServiceConfig } from './config.ts'
import type { DarUploadApi } from './dars.ts'
import type { PartyApi } from './party.ts'
import { InvalidParams, type Rpc } from './rpc.ts'
import type { JsonRpcRequest, JsonRpcResponse } from './types.ts'

interface WalletServiceAppOptions {
  config: WalletServiceConfig
  mockEnabled: boolean
  rpc: Rpc
  adminParty: PartyApi
  darApi: DarUploadApi
}

// Normalizes admin-route failures into HTTP statuses without leaking Express details into APIs.
const handleAdminError = (res: express.Response, error: unknown): void => {
  if (error instanceof InvalidParams) {
    res.status(400).json({ error: error.message })
    return
  }
  console.error('[wallet-service] admin failed', error)
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) })
}

// Builds the HTTP app separately from listen() so admin routes can be tested without a fixed port.
export const createWalletServiceApp = ({
  config,
  mockEnabled,
  rpc,
  adminParty,
  darApi,
}: WalletServiceAppOptions): express.Express => {
  const app = express()

  app.use(
    cors({
      origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
      credentials: true,
    }),
  )

  app.post(
    '/admin/dars',
    express.raw({ type: 'application/octet-stream', limit: '64mb' }),
    async (req, res) => {
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
      try {
        res.json(await darApi.upload(bytes))
      } catch (error) {
        handleAdminError(res, error)
      }
    },
  )

  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'wallet-service', network: config.network, mock: mockEnabled })
  })

  app.get('/', (_req, res) => {
    res.json(rpc.serviceInfo())
  })

  app.get('/wallet-service/info', (_req, res) => {
    res.json(rpc.serviceInfo())
  })

  app.post('/admin/party/prepare', async (req, res) => {
    const body = req.body as { publicKeyBase64?: string; partyHint?: string }
    try {
      res.json(await adminParty.prepare(body))
    } catch (error) {
      handleAdminError(res, error)
    }
  })

  app.post('/admin/party/complete', async (req, res) => {
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

  app.post('/rpc', async (req, res) => {
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

  return app
}
