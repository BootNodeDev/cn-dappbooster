import type { WalletServiceConfig } from '../config.js'
import { connectResult } from '../services/networkStatus.js'
import { network, provider } from '../services/serviceInfo.js'
import type { LedgerService } from '../services/ledgerService.js'
import type { PartyService } from '../services/partyService.js'
import { rpcError, rpcResult, unsupported } from './response.js'
import type { JsonRpcRequest, RpcResponse } from './types.js'

type RpcHandlerDependencies = {
  config: WalletServiceConfig
  ledgerService: LedgerService
  partyService: PartyService
}

export const createRpcHandler = ({ config, ledgerService, partyService }: RpcHandlerDependencies) => {
  const handleRpc = async (request: JsonRpcRequest): Promise<RpcResponse> => {
    const id = request.id ?? null
    if (request.jsonrpc !== undefined && request.jsonrpc !== '2.0') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'jsonrpc must be "2.0"' })
    }
    if (typeof request.method !== 'string') {
      return rpcError(id, -32600, 'Invalid request', { reason: 'method must be a string' })
    }

    switch (request.method) {
      case 'status': {
        const connection = await connectResult(config)
        return rpcResult(id, { provider: provider(config), connection, network: network(config) })
      }
      case 'connect':
      case 'isConnected':
        return rpcResult(id, await connectResult(config))
      case 'disconnect':
        return rpcResult(id, null)
      case 'getActiveNetwork':
        return rpcResult(id, network(config))
      case 'listAccounts':
        return rpcResult(id, [])
      case 'getPrimaryAccount':
        return rpcError(id, -32001, 'Resource not found', { reason: 'No primary account configured yet.' })
      case 'prepareTransaction':
        return rpcResult(id, await ledgerService.prepareTransaction(request.params))
      case 'executePrepared':
        return rpcResult(id, await ledgerService.executePrepared(request.params))
      case 'ledgerApi':
        return rpcResult(id, await ledgerService.ledgerApi(request.params))
      case 'prepareCreateParty':
        return rpcResult(id, await partyService.prepareCreateParty(request.params))
      case 'completeCreateParty':
        return rpcResult(id, await partyService.completeCreateParty(request.params))
      case 'prepareExecute':
      case 'prepareExecuteAndWait':
      case 'signMessage':
        return unsupported(id, request.method)
      default:
        return rpcError(id, -32601, 'Method not found', { method: request.method })
    }
  }

  return handleRpc
}
