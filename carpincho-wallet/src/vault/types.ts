// On-disk shape. Binary fields are base64. Bump `v` and add a migration in storage.ts on layout changes.
export interface EncryptedVault {
  v: 1
  kdf: {
    name: 'PBKDF2'
    hash: 'SHA-256'
    iterations: number
    salt: string
  }
  cipher: {
    name: 'AES-GCM'
    iv: string
    data: string
  }
}

export interface VaultPlaintext {
  v: 1
  primaryAccountId: string | null
  accounts: AccountSecret[]
}

export interface AccountSecret {
  id: string
  name: string
  partyId: string
  privateKeyHex: string
  publicKeyBase64: string
  network: string
  createdAt: number
}

// Public projection — never includes the private key.
export interface AccountPublic {
  id: string
  name: string
  partyId: string
  publicKeyBase64: string
  network: string
  isPrimary: boolean
  createdAt: number
}
