// Plaintext + unlock password live in module-scope closures, never in React
// state, so DevTools, error reporters, and Redux extensions never see them.

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from 'react'
import { assertSecureContext, encryptVault, decryptVault } from './crypto.js'
import { hasVault as hasVaultOnDisk, loadVault, rotateVault, wipeVault, writeFreshVault } from './storage.js'
import {
  clearSessionPassword,
  persistSessionPassword,
  readSessionPassword,
  shouldWipeMemoryOnPageHide
} from './sessionUnlock.js'
import { signMessageBase64 } from './keypair.js'
import type { AccountPublic, AccountSecret, TransactionRecord, VaultPlaintext } from './types.js'

const IDLE_LOCK_MS = 15 * 60 * 1000
const MAX_TRANSACTION_HISTORY = 50

let unlockedPlaintext: VaultPlaintext | null = null
let cachedPassword: string | null = null

const wipeMemory = async (): Promise<void> => {
  if (cachedPassword !== null) {
    cachedPassword = ''
    cachedPassword = null
  }
  if (unlockedPlaintext !== null) {
    for (const a of unlockedPlaintext.accounts) {
      a.privateKeyHex = ''
    }
    unlockedPlaintext = null
  }
  await clearSessionPassword()
}

const toPublic = (a: AccountSecret, primaryId: string | null): AccountPublic => ({
  id: a.id,
  name: a.name,
  partyId: a.partyId,
  publicKeyBase64: a.publicKeyBase64,
  network: a.network,
  isPrimary: a.id === primaryId,
  createdAt: a.createdAt
})

const generateId = (): string => {
  const buf = new Uint8Array(16)
  crypto.getRandomValues(buf)
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('')
}

const transactionHistory = (): TransactionRecord[] => unlockedPlaintext?.transactions ?? []

export interface VaultContextValue {
  isLocked: boolean
  hasVault: boolean
  setup: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  destroyVault: () => void
  accounts: AccountPublic[]
  primary: AccountPublic | null
  transactions: TransactionRecord[]
  setPrimary: (id: string) => Promise<void>
  addAccount: (args: {
    name: string
    partyId: string
    network: string
    privateKeyHex: string
    publicKeyBase64: string
  }) => Promise<AccountPublic>
  removeAccount: (id: string) => Promise<void>
  signMessage: (accountId: string, messageBase64: string) => Promise<string>
  recordTransaction: (args: Omit<TransactionRecord, 'id' | 'createdAt'>) => Promise<TransactionRecord>
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

export const VaultContext = createContext<VaultContextValue | undefined>(undefined)

export const VaultProvider = ({ children }: PropsWithChildren): JSX.Element => {
  assertSecureContext()

  const [tick, setTick] = useState(0)
  const [isLocked, setIsLocked] = useState(unlockedPlaintext === null)
  const [vaultExists, setVaultExists] = useState(hasVaultOnDisk())
  const idleTimer = useRef<number | undefined>(undefined)

  const bump = useCallback((): void => setTick(t => t + 1), [])

  const lock = useCallback((): void => {
    void wipeMemory().catch(() => undefined)
    setIsLocked(true)
    bump()
  }, [bump])

  const persist = useCallback(async (): Promise<void> => {
    if (unlockedPlaintext === null || cachedPassword === null) {
      throw new Error('vault not unlocked')
    }
    const blob = await encryptVault(cachedPassword, JSON.stringify(unlockedPlaintext))
    rotateVault(blob)
  }, [])

  const setup = useCallback(async (password: string): Promise<void> => {
    if (hasVaultOnDisk()) {
      throw new Error('vault already exists')
    }
    if (password.length < 8) {
      throw new Error('password must be at least 8 characters')
    }
    const plaintext: VaultPlaintext = { v: 1, primaryAccountId: null, accounts: [], transactions: [] }
    const blob = await encryptVault(password, JSON.stringify(plaintext))
    writeFreshVault(blob)
    unlockedPlaintext = plaintext
    cachedPassword = password
    await persistSessionPassword(password)
    setVaultExists(true)
    setIsLocked(false)
    bump()
  }, [bump])

  const unlock = useCallback(async (password: string): Promise<void> => {
    const blob = loadVault()
    if (blob === null) {
      throw new Error('no vault to unlock')
    }
    let decrypted: string
    try {
      decrypted = await decryptVault(password, blob)
    } catch {
      throw new Error('invalid password')
    }
    const parsed = JSON.parse(decrypted) as VaultPlaintext
    if (parsed.v !== 1) {
      throw new Error(`unsupported vault payload version: ${String(parsed.v)}`)
    }
    parsed.transactions ??= []
    unlockedPlaintext = parsed
    cachedPassword = password
    await persistSessionPassword(password)
    setIsLocked(false)
    bump()
  }, [bump])

  const destroyVault = useCallback((): void => {
    void wipeMemory().catch(() => undefined)
    wipeVault()
    setVaultExists(false)
    setIsLocked(true)
    bump()
  }, [bump])

  const setPrimary = useCallback(async (id: string): Promise<void> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    if (!unlockedPlaintext.accounts.some(a => a.id === id)) {
      throw new Error(`unknown account: ${id}`)
    }
    unlockedPlaintext.primaryAccountId = id
    await persist()
    bump()
  }, [persist, bump])

  // Caller (AddAccountView) generates the keypair before creating the Canton external party.
  // Generating a new key here would desync the vault entry from the account UI.
  const addAccount = useCallback(async (args: {
    name: string
    partyId: string
    network: string
    privateKeyHex: string
    publicKeyBase64: string
  }): Promise<AccountPublic> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    const id = generateId()
    const secret: AccountSecret = {
      id,
      name: args.name,
      partyId: args.partyId,
      privateKeyHex: args.privateKeyHex,
      publicKeyBase64: args.publicKeyBase64,
      network: args.network,
      createdAt: Date.now()
    }
    unlockedPlaintext.accounts.push(secret)
    if (unlockedPlaintext.primaryAccountId === null) {
      unlockedPlaintext.primaryAccountId = id
    }
    await persist()
    bump()
    return toPublic(secret, unlockedPlaintext.primaryAccountId)
  }, [persist, bump])

  const recordTransaction = useCallback(async (
    args: Omit<TransactionRecord, 'id' | 'createdAt'>
  ): Promise<TransactionRecord> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    const record: TransactionRecord = {
      id: generateId(),
      createdAt: Date.now(),
      ...args
    }
    const next = [record, ...transactionHistory()]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_TRANSACTION_HISTORY)
    unlockedPlaintext.transactions = next
    await persist()
    bump()
    return record
  }, [persist, bump])

  const removeAccount = useCallback(async (id: string): Promise<void> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    unlockedPlaintext.accounts = unlockedPlaintext.accounts.filter(a => a.id !== id)
    if (unlockedPlaintext.primaryAccountId === id) {
      unlockedPlaintext.primaryAccountId = unlockedPlaintext.accounts[0]?.id ?? null
    }
    await persist()
    bump()
  }, [persist, bump])

  const signMessage = useCallback(async (accountId: string, messageBase64: string): Promise<string> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    const acct = unlockedPlaintext.accounts.find(a => a.id === accountId)
    if (acct === undefined) {
      throw new Error(`unknown account: ${accountId}`)
    }
    return await signMessageBase64(acct.privateKeyHex, messageBase64)
  }, [])

  const changePassword = useCallback(async (oldPassword: string, newPassword: string): Promise<void> => {
    if (unlockedPlaintext === null) {
      throw new Error('vault locked')
    }
    if (cachedPassword !== oldPassword) {
      throw new Error('invalid current password')
    }
    if (newPassword.length < 8) {
      throw new Error('new password must be at least 8 characters')
    }
    const blob = await encryptVault(newPassword, JSON.stringify(unlockedPlaintext))
    rotateVault(blob)
    cachedPassword = newPassword
    await persistSessionPassword(newPassword)
    bump()
  }, [bump])

  // Restore the unlocked session on first mount.
  useEffect(() => {
    if (unlockedPlaintext !== null || !hasVaultOnDisk()) {
      return
    }
    void (async () => {
      const stored = await readSessionPassword()
      if (stored === null || stored === '') {
        return
      }
      await unlock(stored).catch(() => { void clearSessionPassword() })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 15-min idle auto-lock — driven by activity on this window, not tab visibility,
  // so a backgrounded wallet can still respond to dApp WC requests.
  useEffect(() => {
    if (isLocked) {
      return
    }
    const reset = (): void => {
      if (idleTimer.current !== undefined) {
        window.clearTimeout(idleTimer.current)
      }
      idleTimer.current = window.setTimeout(lock, IDLE_LOCK_MS)
    }
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    for (const e of events) {
      window.addEventListener(e, reset, { passive: true })
    }
    reset()
    return () => {
      for (const e of events) {
        window.removeEventListener(e, reset)
      }
      if (idleTimer.current !== undefined) {
        window.clearTimeout(idleTimer.current)
      }
    }
  }, [isLocked, lock])

  useEffect(() => {
    const onUnload = (): void => {
      if (shouldWipeMemoryOnPageHide()) {
        void wipeMemory().catch(() => undefined)
      }
    }
    window.addEventListener('pagehide', onUnload)
    return () => { window.removeEventListener('pagehide', onUnload) }
  }, [])

  const value = useMemo<VaultContextValue>(() => {
    const primaryId = unlockedPlaintext?.primaryAccountId ?? null
    const accounts = unlockedPlaintext === null
      ? []
      : unlockedPlaintext.accounts.map(a => toPublic(a, primaryId))
    const primary = accounts.find(a => a.isPrimary) ?? null
    const transactions = unlockedPlaintext === null
      ? []
      : [...transactionHistory()].sort((a, b) => b.createdAt - a.createdAt)
    return {
      isLocked,
      hasVault: vaultExists,
      setup,
      unlock,
      lock,
      destroyVault,
      accounts,
      primary,
      transactions,
      setPrimary,
      addAccount,
      removeAccount,
      signMessage,
      recordTransaction,
      changePassword
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, vaultExists, tick, setup, unlock, lock, destroyVault, setPrimary, addAccount, removeAccount, signMessage, recordTransaction, changePassword])

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}
