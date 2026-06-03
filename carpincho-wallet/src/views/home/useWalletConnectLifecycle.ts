import { type Dispatch, type SetStateAction, useEffect } from 'react'
import { toast } from '@/components/ui/toast'
import type { ProviderRequestHandler } from '@/views/home/useProviderRequestHandler'
import {
  type ConnectedDappSession,
  type ProposalEvent,
  pairWithUri,
  subscribeToProposals,
  subscribeToRequests,
  subscribeToSessionChanges,
  walletConnectResponder,
} from '@/wc/client'

interface WalletConnectLifecycleArgs {
  extensionMode: boolean
  handleProviderRequest: ProviderRequestHandler
  setSessions: Dispatch<SetStateAction<ConnectedDappSession[]>>
  setProposal: Dispatch<SetStateAction<ProposalEvent | undefined>>
}

// Drives the web-mode WalletConnect lifecycle: query-param pairing, session sync, proposal and
// request subscriptions. Inert in extension mode, where requests arrive via the runtime bridge.
export const useWalletConnectLifecycle = ({
  extensionMode,
  handleProviderRequest,
  setSessions,
  setProposal,
}: WalletConnectLifecycleArgs): void => {
  useEffect(() => {
    if (extensionMode) {
      return
    }
    const params = new URLSearchParams(window.location.search)
    const wc = params.get('wc')
    if (wc === null || wc === '') {
      return
    }
    pairWithUri(wc)
      .then(() => {
        params.delete('wc')
        const newQuery = params.toString()
        const url = `${window.location.pathname}${newQuery === '' ? '' : `?${newQuery}`}${window.location.hash}`
        window.history.replaceState(null, '', url)
      })
      .catch((err: Error) => toast.error(`Pair failed: ${err.message}`))
  }, [extensionMode])

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsub: (() => void) | undefined
    void subscribeToSessionChanges(setSessions)
      .then((fn) => {
        unsub = fn
      })
      .catch((err: Error) => toast.error(`WalletConnect sessions failed: ${err.message}`))
    return () => {
      unsub?.()
    }
  }, [extensionMode, setSessions])

  useEffect(() => {
    if (extensionMode) {
      return
    }
    let unsubP: (() => void) | undefined
    let unsubR: (() => void) | undefined
    void (async () => {
      unsubP = await subscribeToProposals(setProposal)
      unsubR = await subscribeToRequests(async (req) => {
        try {
          await handleProviderRequest(
            {
              method: req.params.request.method,
              params: req.params.request.params,
            },
            walletConnectResponder(req),
            { rawMethod: req.params.request.method },
          )
        } catch (error) {
          console.error('[carpincho:wc] request handler failed', { req, error })
          toast.error(`WalletConnect request failed: ${(error as Error).message}`)
        }
      })
    })().catch((err: Error) => toast.error(`WalletConnect init failed: ${err.message}`))
    return () => {
      unsubP?.()
      unsubR?.()
    }
  }, [extensionMode, handleProviderRequest, setProposal])
}
