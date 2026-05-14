import type { JsonRpcError, JsonRpcId, JsonRpcResult } from './types.js'

export const rpcResult = (id: JsonRpcId, result: unknown): JsonRpcResult => ({ jsonrpc: '2.0', id, result })

export const rpcError = (id: JsonRpcId, code: number, message: string, data?: unknown): JsonRpcError => ({
  jsonrpc: '2.0',
  id,
  error: data === undefined ? { code, message } : { code, message, data }
})

export const unsupported = (id: JsonRpcId, method: string): JsonRpcError =>
  rpcError(id, -32004, 'Method not supported', {
    method,
    reason: 'This wallet-service has no private keys. Use Carpincho over WalletConnect for dApp-facing signing methods.'
  })
