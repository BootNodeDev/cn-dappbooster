export type JsonRpcId = string | number | null

export type JsonRpcRequest = {
  jsonrpc?: '2.0'
  id?: JsonRpcId
  method?: unknown
  params?: unknown
}

export type JsonRpcResult = {
  jsonrpc: '2.0'
  id: JsonRpcId
  result: unknown
}

export type JsonRpcError = {
  jsonrpc: '2.0'
  id: JsonRpcId
  error: {
    code: number
    message: string
    data?: unknown
  }
}

export type RpcResponse = JsonRpcResult | JsonRpcError
