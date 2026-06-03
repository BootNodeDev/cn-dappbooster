// Push a dapp-api event to content-script pages via
// chrome.runtime → background.ts → chrome.tabs → SPLICE_WALLET_EVENT.
// No-op on the web variant where chrome.runtime is undefined.

import type { RuntimeBroadcastEvent } from '@/extension/messages'

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
