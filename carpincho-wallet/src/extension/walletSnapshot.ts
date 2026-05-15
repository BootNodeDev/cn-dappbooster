import type { AccountPublic } from '../vault/types.ts'

const WALLET_SNAPSHOT_KEY = 'carpincho.wallet.snapshot'

type ChromeSessionStorage = {
  set: (items: Record<string, unknown>) => Promise<void> | void
  get: (key: string) => Promise<Record<string, unknown>> | Record<string, unknown>
  remove: (key: string) => Promise<void> | void
}

const chromeSessionStorage = (): ChromeSessionStorage | undefined =>
  (globalThis as {
    chrome?: {
      storage?: {
        session?: ChromeSessionStorage
      }
    }
  }).chrome?.storage?.session

export interface ExtensionWalletSnapshot {
  accounts: AccountPublic[]
  primary: AccountPublic | null
  updatedAt: number
}

const isAccountPublic = (value: unknown): value is AccountPublic =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as AccountPublic).id === 'string' &&
  typeof (value as AccountPublic).name === 'string' &&
  typeof (value as AccountPublic).partyId === 'string' &&
  typeof (value as AccountPublic).publicKeyBase64 === 'string' &&
  typeof (value as AccountPublic).network === 'string' &&
  typeof (value as AccountPublic).isPrimary === 'boolean' &&
  typeof (value as AccountPublic).createdAt === 'number'

const isWalletSnapshot = (value: unknown): value is ExtensionWalletSnapshot =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as ExtensionWalletSnapshot).accounts) &&
  (value as ExtensionWalletSnapshot).accounts.every(isAccountPublic) &&
  (
    (value as ExtensionWalletSnapshot).primary === null ||
    isAccountPublic((value as ExtensionWalletSnapshot).primary)
  ) &&
  typeof (value as ExtensionWalletSnapshot).updatedAt === 'number'

export const persistWalletSnapshot = async (
  snapshot: Omit<ExtensionWalletSnapshot, 'updatedAt'> | null
): Promise<void> => {
  const storage = chromeSessionStorage()
  if (storage === undefined) {
    return
  }
  if (snapshot === null) {
    await storage.remove(WALLET_SNAPSHOT_KEY)
    return
  }
  await storage.set({
    [WALLET_SNAPSHOT_KEY]: {
      ...snapshot,
      updatedAt: Date.now()
    } satisfies ExtensionWalletSnapshot
  })
}

export const readWalletSnapshot = async (): Promise<ExtensionWalletSnapshot | null> => {
  const storage = chromeSessionStorage()
  if (storage === undefined) {
    return null
  }
  const stored = await storage.get(WALLET_SNAPSHOT_KEY)
  const snapshot = stored[WALLET_SNAPSHOT_KEY]
  return isWalletSnapshot(snapshot) ? snapshot : null
}
