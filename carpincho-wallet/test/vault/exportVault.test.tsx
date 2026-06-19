import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
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

describe('VaultContext.exportVault', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('builds a v1 envelope of every account, omitting id and createdAt', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      await ref.current?.addAccount({
        name: 'alice',
        partyId: 'alice::ns',
        network: 'localnet',
        privateKeyHex: 'aa'.repeat(32),
        publicKeyBase64: 'alice-pub',
      })
      await ref.current?.addAccount({
        name: 'bob',
        partyId: 'bob::ns',
        network: 'devnet',
        privateKeyHex: 'bb'.repeat(32),
        publicKeyBase64: 'bob-pub',
      })
    })

    const envelope = ref.current?.exportVault()
    assert.equal(envelope?.v, 1)
    assert.equal(envelope?.accounts.length, 2)
    assert.deepEqual(envelope?.accounts[0], {
      name: 'alice',
      partyId: 'alice::ns',
      publicKeyBase64: 'alice-pub',
      privateKeyHex: 'aa'.repeat(32),
      network: 'localnet',
    })
    assert.equal(Object.hasOwn(envelope?.accounts[0] ?? {}, 'id'), false)
    assert.equal(Object.hasOwn(envelope?.accounts[0] ?? {}, 'createdAt'), false)
  })

  it('throws when the vault is locked', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      ref.current?.lock()
    })
    assert.throws(() => ref.current?.exportVault(), /vault locked/i)
  })
})
