import type { EncryptedVault } from '@/vault/types'

const KEY_VAULT = 'carpincho.vault'
const KEY_VAULT_NEXT = 'carpincho.vault.next'

const parse = (raw: string): EncryptedVault | null => {
  try {
    const obj = JSON.parse(raw) as EncryptedVault
    return obj.v === 1 ? obj : null
  } catch {
    return null
  }
}

export const loadVault = (): EncryptedVault | null => {
  // If a rotation was interrupted mid-write, the .next blob is the new canonical one.
  const next = localStorage.getItem(KEY_VAULT_NEXT)
  if (next !== null) {
    const parsed = parse(next)
    if (parsed !== null) {
      localStorage.setItem(KEY_VAULT, next)
      localStorage.removeItem(KEY_VAULT_NEXT)
      return parsed
    }
    localStorage.removeItem(KEY_VAULT_NEXT)
  }
  const cur = localStorage.getItem(KEY_VAULT)
  return cur === null ? null : parse(cur)
}

export const hasVault = (): boolean => loadVault() !== null

export const writeFreshVault = (blob: EncryptedVault): void => {
  localStorage.setItem(KEY_VAULT, JSON.stringify(blob))
  localStorage.removeItem(KEY_VAULT_NEXT)
}

// Two-step write so an interrupted setItem can't strand the user with no vault.
export const rotateVault = (blob: EncryptedVault): void => {
  const serialized = JSON.stringify(blob)
  localStorage.setItem(KEY_VAULT_NEXT, serialized)
  localStorage.setItem(KEY_VAULT, serialized)
  localStorage.removeItem(KEY_VAULT_NEXT)
}

export const wipeVault = (): void => {
  localStorage.removeItem(KEY_VAULT)
  localStorage.removeItem(KEY_VAULT_NEXT)
}

// Reset wipes every `carpincho`-namespaced key (vault + all prefs) by prefix, so
// preferences added later are cleared without touching this.
const STORAGE_PREFIX = 'carpincho'

export const wipeAllPersistedData = (): void => {
  const stale: string[] = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (key?.startsWith(STORAGE_PREFIX)) {
      stale.push(key)
    }
  }
  for (const key of stale) {
    // Remove defensively: one failing key (e.g. storage disabled mid-wipe) must not
    // strand the rest, since destroyVault reloads regardless of what survives here.
    try {
      localStorage.removeItem(key)
    } catch {
      // Best effort; a key that cannot be removed is left for the reload to surface.
    }
  }
}

const KEY_AUTO_LOCK = 'carpincho.autoLockOption'

export const AUTO_LOCK_OPTIONS = ['never', '1m', '5m', '1h'] as const
export type AutoLockOption = (typeof AUTO_LOCK_OPTIONS)[number]

const isAutoLockOption = (raw: string | null): raw is AutoLockOption =>
  raw !== null && (AUTO_LOCK_OPTIONS as readonly string[]).includes(raw)

export const loadAutoLockOption = (): AutoLockOption => {
  const raw = localStorage.getItem(KEY_AUTO_LOCK)
  return isAutoLockOption(raw) ? raw : 'never'
}

export const writeAutoLockOption = (option: AutoLockOption): void => {
  localStorage.setItem(KEY_AUTO_LOCK, option)
}
