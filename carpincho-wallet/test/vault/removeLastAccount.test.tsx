import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { useVault } from '@/vault/useVault.ts'
import { type VaultContextValue, VaultProvider } from '@/vault/VaultContext.tsx'

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

const addAccount = async (
  ref: { current: VaultContextValue | null },
  name: string,
): Promise<string> => {
  let id = ''
  await act(async () => {
    const account = await ref.current?.addAccount({
      name,
      partyId: `party-${name}`,
      network: 'localnet',
      privateKeyHex: 'aa'.repeat(32),
      publicKeyBase64: 'cHVibGlj',
    })
    id = account?.id ?? ''
  })
  return id
}

describe('VaultContext.removeAccount last-account guard', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('refuses to remove the only remaining account', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    const onlyId = await addAccount(ref, 'alice')

    await assert.rejects(
      () => ref.current?.removeAccount(onlyId) ?? Promise.resolve(),
      /last account/i,
    )
    assert.equal(ref.current?.accounts.length, 1)
  })

  it('allows removing an account when more than one exists', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    const firstId = await addAccount(ref, 'alice')
    await addAccount(ref, 'bob')

    await act(async () => {
      await ref.current?.removeAccount(firstId)
    })
    assert.equal(ref.current?.accounts.length, 1)
  })
})
