// Push a dapp-api event (accountsChanged, txChanged, ...) from the wallet UI
// to every page where Carpincho's content script is running.
//
// Wire: this helper → chrome.runtime → background.ts → chrome.tabs → content
// script → window.postMessage(SPLICE_WALLET_EVENT). The dApp's provider listens
// for SPLICE_WALLET_EVENT and calls `provider.emit(eventName, payload)` so
// `client.onAccountsChanged(listener)` fires per the canonical SDK contract.
//
// On the web variant (carpincho running as a regular page at localhost:3011),
// chrome.runtime is undefined and this is a no-op — events only ride the
// extension transport for now.

import type { RuntimeBroadcastEvent } from '@/extension/messages.ts'

type RuntimeApi = {
  sendMessage: (message: RuntimeBroadcastEvent) => Promise<unknown>
}

const runtime = (globalThis as { chrome?: { runtime?: RuntimeApi } }).chrome?.runtime

export const broadcastWalletEvent = async (eventName: string, payload: unknown): Promise<void> => {
  if (runtime === undefined) {
    return
  }
  await runtime
    .sendMessage({
      type: 'CARPINCHO_BROADCAST_EVENT',
      eventName,
      payload,
    })
    .catch(() => undefined)
}
