import { normalizeDirectConnectionOrigin } from '@/extension/directConnectionState.ts'

export const DIRECT_CONNECTED_ORIGINS_KEY = 'carpincho.direct.connectedOrigins'

type ChromeSessionStorage = {
  set: (items: Record<string, unknown>) => Promise<void> | void
  get: (key: string) => Promise<Record<string, unknown>> | Record<string, unknown>
}

const fallbackOrigins = new Set<string>()

// Serializes remember/forget read-modify-write sequences so concurrent calls cannot lose a write.
let lastWrite: Promise<unknown> = Promise.resolve()
const withWriteLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = lastWrite.then(fn, fn)
  lastWrite = next.catch(() => undefined)
  return next
}

// Reads Chrome session storage when the code is running in the extension background.
const chromeSessionStorage = (): ChromeSessionStorage | undefined =>
  (
    globalThis as {
      chrome?: {
        storage?: {
          session?: ChromeSessionStorage
        }
      }
    }
  ).chrome?.storage?.session

// Returns only string origins from untyped Chrome storage payloads.
export const storedOrigins = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

// Deduplicates and sorts normalized origins so footer state is stable across writes.
const normalizeOriginList = (origins: string[]): string[] =>
  [
    ...new Set(
      origins
        .map(normalizeDirectConnectionOrigin)
        .filter((origin): origin is string => origin !== undefined),
    ),
  ].sort()

// Reads the dApp origins that completed a direct injected-provider connect request.
export const readDirectConnectedOrigins = async (): Promise<string[]> => {
  const storage = chromeSessionStorage()
  if (storage === undefined) {
    return [...fallbackOrigins].sort()
  }
  const stored = await storage.get(DIRECT_CONNECTED_ORIGINS_KEY)
  return normalizeOriginList(storedOrigins(stored[DIRECT_CONNECTED_ORIGINS_KEY]))
}

// Persists the current direct connected origins for popup reads and service-worker restarts.
const writeDirectConnectedOrigins = async (origins: string[]): Promise<string[]> => {
  const normalized = normalizeOriginList(origins)
  const storage = chromeSessionStorage()
  if (storage === undefined) {
    fallbackOrigins.clear()
    for (const origin of normalized) {
      fallbackOrigins.add(origin)
    }
    return normalized
  }
  await storage.set({ [DIRECT_CONNECTED_ORIGINS_KEY]: normalized })
  return normalized
}

// Adds one direct dApp origin after a successful injected-provider connect response.
export const rememberDirectConnectedOrigin = async (origin: string): Promise<string[]> => {
  const normalized = normalizeDirectConnectionOrigin(origin)
  if (normalized === undefined) {
    return await readDirectConnectedOrigins()
  }
  return await withWriteLock(async () =>
    writeDirectConnectedOrigins([...(await readDirectConnectedOrigins()), normalized]),
  )
}

// Removes one direct dApp origin after an injected-provider disconnect response.
export const forgetDirectConnectedOrigin = async (origin: string): Promise<string[]> => {
  const normalized = normalizeDirectConnectionOrigin(origin)
  if (normalized === undefined) {
    return await readDirectConnectedOrigins()
  }
  return await withWriteLock(async () =>
    writeDirectConnectedOrigins(
      (await readDirectConnectedOrigins()).filter(
        (connectedOrigin) => connectedOrigin !== normalized,
      ),
    ),
  )
}
