import 'dotenv/config'

import cors from 'cors'
import express from 'express'
import { loadConfig } from './config.ts'
import { createRpc } from './rpc.ts'
import type { JsonRpcRequest, JsonRpcResponse } from './types.ts'

const config = loadConfig()
const rpc = createRpc(config)
const app = express()

app.use(cors({
  origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
  credentials: true
}))
app.use(express.json({ limit: '1mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'counter-wallet-service', network: config.network })
})

app.get('/', (_req, res) => {
  res.json(rpc.serviceInfo())
})

app.get('/wallet-service/info', (_req, res) => {
  res.json(rpc.serviceInfo())
})

app.post('/rpc', async (req, res) => {
  const body = req.body as unknown
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    const response: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: { code: -32600, message: 'Invalid request', data: { reason: 'JSON-RPC body must be an object' } }
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

app.listen(config.port, () => {
  console.log(`counter-wallet-service listening on ${config.port}`)
})
