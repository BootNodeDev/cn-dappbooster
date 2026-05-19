const SESSION_KEY = 'carpincho.session.unlock'
const LOCK_AT_KEY = 'carpincho.session.lockAt'

type ChromeSessionStorage = {
  set: (items: Record<string, string>) => Promise<void> | void
  get: (
    key: string,
  ) => Promise<Record<string, string | undefined>> | Record<string, string | undefined>
  remove: (key: string) => Promise<void> | void
}

const chromeSessionStorage = (): ChromeSessionStorage | undefined => {
  const candidate = (
    globalThis as {
      chrome?: {
        storage?: {
          session?: ChromeSessionStorage
        }
      }
    }
  ).chrome?.storage?.session
  return candidate
}

const isExtensionRuntime = (): boolean =>
  typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:'

const fallbackSessionStorage = (): Storage | undefined => {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

const setKey = async (key: string, value: string): Promise<void> => {
  const ext = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (ext !== undefined) {
    try {
      await ext.set({ [key]: value })
      return
    } catch {
      // Fall back to page session storage below.
    }
  }
  fallbackSessionStorage()?.setItem(key, value)
}

const getKey = async (key: string): Promise<string | null> => {
  const ext = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (ext !== undefined) {
    try {
      const stored = await ext.get(key)
      return stored[key] ?? null
    } catch {
      // Fall back to page session storage below.
    }
  }
  return fallbackSessionStorage()?.getItem(key) ?? null
}

const removeKey = async (key: string): Promise<void> => {
  const ext = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (ext !== undefined) {
    try {
      await ext.remove(key)
      return
    } catch {
      // Fall back to page session storage below.
    }
  }
  fallbackSessionStorage()?.removeItem(key)
}

export const persistSessionPassword = async (password: string): Promise<void> =>
  setKey(SESSION_KEY, password)

export const readSessionPassword = async (): Promise<string | null> => getKey(SESSION_KEY)

export const clearSessionPassword = async (): Promise<void> => removeKey(SESSION_KEY)

export const persistLockAt = async (timestamp: number): Promise<void> =>
  setKey(LOCK_AT_KEY, String(timestamp))

export const readLockAt = async (): Promise<number | null> => {
  const raw = await getKey(LOCK_AT_KEY)
  if (raw === null) return null
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

export const clearLockAt = async (): Promise<void> => removeKey(LOCK_AT_KEY)

export const shouldWipeMemoryOnPageHide = (): boolean => !isExtensionRuntime()
