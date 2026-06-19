// Domain-marked container around an EncryptedVault, plus the guard that protects the
// import path from being fed a raw vault blob (or any unrelated JSON).
import type { CarpinchoBackup, EncryptedVault } from '@/vault/types'

export const BACKUP_KIND = 'carpincho-backup' as const
export const BACKUP_VERSION = 1 as const

const isEncryptedVault = (x: unknown): x is EncryptedVault => {
  if (x === null || typeof x !== 'object') {
    return false
  }
  const o = x as Record<string, unknown>
  return (
    o.v === 1 &&
    typeof o.kdf === 'object' &&
    o.kdf !== null &&
    typeof o.cipher === 'object' &&
    o.cipher !== null
  )
}

const isCarpinchoBackup = (x: unknown): x is CarpinchoBackup => {
  if (x === null || typeof x !== 'object') {
    return false
  }
  const o = x as Record<string, unknown>
  return o.kind === BACKUP_KIND && o.version === BACKUP_VERSION && isEncryptedVault(o.vault)
}

export const wrapBackup = (vault: EncryptedVault): CarpinchoBackup => ({
  kind: BACKUP_KIND,
  version: BACKUP_VERSION,
  vault,
})

// Returns the embedded EncryptedVault, or throws a human-readable error if the value
// is not a recognizable Carpincho backup container.
export const parseBackupContainer = (file: unknown): EncryptedVault => {
  if (!isCarpinchoBackup(file)) {
    throw new Error("This file isn't a Carpincho backup.")
  }
  return file.vault
}
