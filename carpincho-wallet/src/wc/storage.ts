// WalletConnect's browser KeyValueStorage (@walletconnect/keyvaluestorage) persists sessions,
// pairings, and the keychain in this IndexedDB database. The `carpincho` localStorage prefix wipe
// never reaches it, so a vault reset must drop the database to stop dApp session history from
// surviving into the next wallet.
export const WALLET_CONNECT_DB = 'WALLET_CONNECT_V2_INDEXED_DB'

export const wipeWalletConnectStorage = async (): Promise<void> => {
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB
  if (idb === undefined) {
    return
  }
  await new Promise<void>((resolve) => {
    try {
      const request = idb.deleteDatabase(WALLET_CONNECT_DB)
      request.onsuccess = () => resolve()
      request.onerror = () => resolve()
      // An open WC connection blocks deletion; the reload that follows a reset closes it and
      // the queued delete completes, so treat blocked as done rather than hanging the reset.
      // (onblocked may later be followed by onsuccess, but resolving an already-settled promise is a no-op.)
      request.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}
