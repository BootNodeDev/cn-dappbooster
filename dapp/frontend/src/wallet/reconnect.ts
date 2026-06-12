// Remembers a successful Carpincho extension connection so a page reload can
// silently reconnect. WalletConnect sessions are reconnected manually, so only
// the 'extension' mode is persisted.

const RECONNECT_KEY = 'cc-vesting:reconnect'

export const readReconnect = (): 'extension' | null => {
  try {
    return window.localStorage.getItem(RECONNECT_KEY) === 'extension' ? 'extension' : null
  } catch {
    return null
  }
}

export const writeReconnect = (value: 'extension' | null): void => {
  try {
    if (value === null) {
      window.localStorage.removeItem(RECONNECT_KEY)
    } else {
      window.localStorage.setItem(RECONNECT_KEY, value)
    }
  } catch {
    // ignore quota / privacy errors
  }
}
