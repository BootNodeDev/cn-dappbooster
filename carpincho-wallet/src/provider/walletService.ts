import { WalletServiceRpcError, walletServiceRequest } from '@/api/walletService'
import type { DispatchResult, ProviderRequest, ProviderResponder } from '@/provider/types'

export const forwardToWalletService = async (
  request: ProviderRequest,
  method: string,
  responder: ProviderResponder,
): Promise<DispatchResult> => {
  try {
    const result = await walletServiceRequest<unknown>(method, request.params)
    await responder.result(result)
    return { status: 'handled' }
  } catch (error) {
    const code = error instanceof WalletServiceRpcError ? error.code : -32000
    await responder.error(code, `wallet-service: ${(error as Error).message}`)
    return { status: 'error' }
  }
}
