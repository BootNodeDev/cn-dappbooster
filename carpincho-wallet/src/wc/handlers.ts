import {
  dispatchProviderRequest,
  type AccountResolver,
  type DispatchResult,
  type ProviderResponder
} from '../provider/dispatch.js'
import {
  respondWithError,
  respondWithResult,
  type RequestEvent
} from './client.js'

const walletConnectResponder = (req: RequestEvent): ProviderResponder => ({
  result: async value => {
    await respondWithResult(req.topic, req.id, value)
  },
  error: async (code, message) => {
    await respondWithError(req.topic, req.id, code, message)
  }
})

// `resolve` is called lazily so newly added accounts are visible to in-flight requests.
export const dispatchRequest = async (
  req: RequestEvent,
  resolve: AccountResolver
): Promise<DispatchResult> =>
  await dispatchProviderRequest(
    {
      method: req.params.request.method,
      params: req.params.request.params
    },
    resolve,
    walletConnectResponder(req)
  )

export type { AccountResolver, DispatchResult }
