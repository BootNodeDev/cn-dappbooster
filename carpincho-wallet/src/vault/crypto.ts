// PBKDF2-HMAC-SHA256 (600k iters) → AES-256-GCM via SubtleCrypto.
import type { EncryptedVault } from '@/vault/types.ts'

const KDF_ITERATIONS = 600_000
const SALT_BYTES = 16
const IV_BYTES = 12

const enc = new TextEncoder()
const dec = new TextDecoder()

const toBase64 = (bytes: Uint8Array): string => {
  let s = ''
  for (const b of bytes) {
    s += String.fromCharCode(b)
  }
  return btoa(s)
}

// Return Uint8Array<ArrayBuffer> so SubtleCrypto accepts it without TS widening to SharedArrayBuffer.
const fromBase64 = (b64: string): Uint8Array<ArrayBuffer> => {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    out[i] = s.charCodeAt(i)
  }
  return out
}

const randomBytes = (length: number): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(length)
  crypto.getRandomValues(out)
  return out
}

const deriveKey = async (password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: KDF_ITERATIONS },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export const encryptVault = async (
  password: string,
  plaintext: string,
): Promise<EncryptedVault> => {
  const salt = randomBytes(SALT_BYTES)
  const iv = randomBytes(IV_BYTES)
  const key = await deriveKey(password, salt)
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext)),
  )
  return {
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: KDF_ITERATIONS, salt: toBase64(salt) },
    cipher: { name: 'AES-GCM', iv: toBase64(iv), data: toBase64(data) },
  }
}

export const decryptVault = async (password: string, blob: EncryptedVault): Promise<string> => {
  if (blob.v !== 1) {
    throw new Error(`unsupported vault version: ${String(blob.v)}`)
  }
  const key = await deriveKey(password, fromBase64(blob.kdf.salt))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(blob.cipher.iv) },
    key,
    fromBase64(blob.cipher.data),
  )
  return dec.decode(plaintext)
}

export const assertSecureContext = (): void => {
  if (typeof crypto === 'undefined' || crypto.subtle === undefined) {
    throw new Error('Carpincho Wallet requires a secure context (HTTPS or localhost).')
  }
}
