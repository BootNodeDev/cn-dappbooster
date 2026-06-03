import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { encryptVault } from '@/vault/crypto'
import {
  clearLockAt,
  clearSessionPassword,
  persistLockAt,
  persistSessionPassword,
  readLockAt,
  readSessionPassword,
} from '@/vault/sessionUnlock'
import { writeFreshVault } from '@/vault/storage'
import { useVault } from '@/vault/useVault'
import { type VaultContextValue, VaultProvider } from '@/vault/VaultContext'

const captureVault = (): { ref: { current: VaultContextValue | null } } => {
  const ref: { current: VaultContextValue | null } = { current: null }
  const Probe = (): null => {
    ref.current = useVault()
    return null
  }
  render(
    <VaultProvider>
      <Probe />
    </VaultProvider>,
  )
  return { ref }
}

const seedVault = async (password: string): Promise<void> => {
  const plaintext = JSON.stringify({
    v: 1,
    primaryAccountId: null,
    accounts: [],
    transactions: [],
  })
  const blob = await encryptVault(password, plaintext)
  writeFreshVault(blob)
}

const waitFor = async (predicate: () => boolean, timeoutMs = 2000): Promise<void> => {
  const start = Date.now()
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) return
    await act(async () => {
      await new Promise((r) => setTimeout(r, 25))
    })
  }
}

const resetModuleState = async (): Promise<void> => {
  const { ref } = captureVault()
  if (ref.current !== null) {
    act(() => {
      ref.current?.destroyVault()
    })
  }
  cleanup()
  await clearSessionPassword()
  await clearLockAt()
  localStorage.clear()
  sessionStorage.clear()
}

describe('VaultContext restore: lockAt elapsed gate', () => {
  beforeEach(async () => {
    await resetModuleState()
  })

  afterEach(async () => {
    cleanup()
    await resetModuleState()
  })

  it('does not auto-unlock when lockAt has elapsed', async () => {
    await seedVault('correct-horse-battery')
    await persistSessionPassword('correct-horse-battery')
    await persistLockAt(Date.now() - 1000)

    const { ref } = captureVault()
    await waitFor(() => ref.current?.isLoading === false)

    assert.equal(ref.current?.isLocked, true)
    assert.equal(await readSessionPassword(), null)
    assert.equal(await readLockAt(), null)
  })

  it('auto-unlocks when lockAt is still in the future', async () => {
    await seedVault('correct-horse-battery')
    await persistSessionPassword('correct-horse-battery')
    await persistLockAt(Date.now() + 60_000)

    const { ref } = captureVault()
    await waitFor(() => ref.current?.isLocked === false)

    assert.equal(ref.current?.isLocked, false)
    assert.equal(await readSessionPassword(), 'correct-horse-battery')
  })

  it('auto-unlocks when no lockAt is persisted (e.g., autoLockOption never)', async () => {
    await seedVault('correct-horse-battery')
    await persistSessionPassword('correct-horse-battery')

    const { ref } = captureVault()
    await waitFor(() => ref.current?.isLocked === false)

    assert.equal(ref.current?.isLocked, false)
  })
})
