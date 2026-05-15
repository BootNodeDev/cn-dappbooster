const SESSION_KEY = 'carpincho.session.unlock'

type ChromeSessionStorage = {
  set: (items: Record<string, string>) => Promise<void> | void
  get: (key: string) => Promise<Record<string, string | undefined>> | Record<string, string | undefined>
  remove: (key: string) => Promise<void> | void
}

const chromeSessionStorage = (): ChromeSessionStorage | undefined => {
  const candidate = (globalThis as {
    chrome?: {
      storage?: {
        session?: ChromeSessionStorage
      }
    }
  }).chrome?.storage?.session
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

export const persistSessionPassword = async (password: string): Promise<void> => {
  const extensionStorage = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (extensionStorage !== undefined) {
    try {
      await extensionStorage.set({ [SESSION_KEY]: password })
      return
    } catch {
      // Fall back to page session storage below.
    }
  }
  fallbackSessionStorage()?.setItem(SESSION_KEY, password)
}

export const readSessionPassword = async (): Promise<string | null> => {
  const extensionStorage = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (extensionStorage !== undefined) {
    try {
      const stored = await extensionStorage.get(SESSION_KEY)
      return stored[SESSION_KEY] ?? null
    } catch {
      // Fall back to page session storage below.
    }
  }
  return fallbackSessionStorage()?.getItem(SESSION_KEY) ?? null
}

export const clearSessionPassword = async (): Promise<void> => {
  const extensionStorage = isExtensionRuntime() ? chromeSessionStorage() : undefined
  if (extensionStorage !== undefined) {
    try {
      await extensionStorage.remove(SESSION_KEY)
      return
    } catch {
      // Fall back to page session storage below.
    }
  }
  fallbackSessionStorage()?.removeItem(SESSION_KEY)
}

export const shouldWipeMemoryOnPageHide = (): boolean => !isExtensionRuntime()
