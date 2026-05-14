import cors from 'cors'
import express from 'express'
import type { WalletServiceConfig } from './config.js'
import { errorData, errorMessage } from './rpc/errors.js'
import { rpcError } from './rpc/response.js'
import { createRpcHandler } from './rpc/router.js'
import type { JsonRpcRequest } from './rpc/types.js'
import { createLedgerService } from './services/ledgerService.js'
import { createPartyService } from './services/partyService.js'
import { serviceInfo } from './services/serviceInfo.js'
import { createWalletSdkService } from './services/walletSdk.js'

export const createApp = (config: WalletServiceConfig): express.Express => {
  const app = express()
  const walletSdkService = createWalletSdkService(config)
  const ledgerService = createLedgerService(walletSdkService)
  const partyService = createPartyService(walletSdkService)
  const handleRpc = createRpcHandler({ config, ledgerService, partyService })

  app.use(cors({
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    credentials: true
  }))
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'counter-wallet-service', network: config.network })
  })

  app.get('/', (_req, res) => {
    res.json(serviceInfo(config))
  })

  app.get('/wallet-service/info', (_req, res) => {
    res.json(serviceInfo(config))
  })

  app.post('/rpc', async (req, res) => {
    const body = req.body as unknown
    const id = typeof body === 'object' && body !== null && !Array.isArray(body)
      ? ((body as JsonRpcRequest).id ?? null)
      : null
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      res.json(rpcError(null, -32600, 'Invalid request', { reason: 'JSON-RPC body must be an object' }))
      return
    }
    try {
      res.json(await handleRpc(body as JsonRpcRequest))
    } catch (error) {
      console.error('[counter-wallet-service] rpc failed', {
        id,
        method: (body as JsonRpcRequest).method,
        error: errorData(error)
      })
      res.json(rpcError(id, -32000, errorMessage(error), errorData(error)))
    }
  })

  return app
}
