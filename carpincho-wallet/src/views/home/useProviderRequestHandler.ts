import { type Dispatch, type SetStateAction, useCallback } from 'react'
import {
  dispatchProviderRequest,
  type ProviderRequest,
  type ProviderResponder,
} from '@/provider/dispatch.ts'
import {
  CANTON_METHOD_PREPARE_EXECUTE,
  CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
  CANTON_METHOD_SIGN_MESSAGE,
} from '@/provider/methods.ts'
import type { AccountResolver } from '@/provider/types.ts'
import { executeParams } from '@/views/home/transactionSummary.ts'
import type { PendingExecuteRequest, PendingSignRequest } from '@/views/home/types.ts'
import { selectedAccount } from '@/wc/accounts.ts'

export interface ProviderRequestContext {
  rawMethod?: string
}

export type ProviderRequestHandler = (
  request: ProviderRequest,
  responder: ProviderResponder,
  context: ProviderRequestContext,
) => Promise<void>

// Bridges dispatch results that need human approval into the pending-sign / pending-execute state
// that HomeView renders. Both the WalletConnect and extension request paths share this handler.
export const useProviderRequestHandler = (
  resolveAccounts: AccountResolver,
  setPendingSign: Dispatch<SetStateAction<PendingSignRequest | undefined>>,
  setPendingExecute: Dispatch<SetStateAction<PendingExecuteRequest | undefined>>,
): ProviderRequestHandler =>
  useCallback(
    async (request, responder, context) => {
      const result = await dispatchProviderRequest(request, resolveAccounts, responder)
      if (
        result.status === 'pending-approval' &&
        result.pendingMethod === CANTON_METHOD_SIGN_MESSAGE
      ) {
        const messageBase64 = (request.params as { message?: string })?.message
        if (typeof messageBase64 !== 'string') {
          await responder.error(-32602, 'message param missing')
          return
        }
        const account = selectedAccount(resolveAccounts())
        if (account === undefined) {
          await responder.error(-32000, 'no account available')
          return
        }
        setPendingSign({ account, messageBase64, responder })
        return
      }
      if (
        result.status === 'pending-approval' &&
        (result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE ||
          result.pendingMethod === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT)
      ) {
        const account = selectedAccount(resolveAccounts())
        if (account === undefined) {
          await responder.error(-32000, 'no account available')
          return
        }
        setPendingExecute({
          account,
          method: result.pendingMethod,
          params: executeParams(request.params, account.partyId),
          rawMethod: context.rawMethod ?? request.method,
          responder,
        })
      }
    },
    [resolveAccounts, setPendingSign, setPendingExecute],
  )
