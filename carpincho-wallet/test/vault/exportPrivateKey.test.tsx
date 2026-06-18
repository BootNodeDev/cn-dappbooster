import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { useVault } from '@/vault/useVault'
import { type VaultContextValue, VaultProvider } from '@/vault/VaultContext'

// Captures the live vault context so tests can exercise real encrypted-vault mutations.
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

// Export tests cover the only intentional path from vault secrets to UI.
describe('VaultContext.exportPrivateKey', () => {
  beforeEach(() => {
    // Setup: each scenario starts with an empty browser vault store.
    localStorage.clear()
  })

  afterEach(() => {
    // Cleanup: remove mounted providers and encrypted vault blobs between scenarios.
    cleanup()
    localStorage.clear()
  })

  it('returns the private key for the requested unlocked account only', async () => {
    // Scenario: export uses an explicit secret accessor so public account lists stay secret-free.
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      await ref.current?.addAccount({
        name: 'alice',
        partyId: 'alice::party',
        network: 'localnet',
        privateKeyHex: 'aa'.repeat(32),
        publicKeyBase64: 'alice-public',
      })
      await ref.current?.addAccount({
        name: 'bob',
        partyId: 'bob::party',
        network: 'localnet',
        privateKeyHex: 'bb'.repeat(32),
        publicKeyBase64: 'bob-public',
      })
    })
    const bob = ref.current?.accounts.find((account) => account.name === 'bob')

    // Expected result: exporting Bob returns Bob's key and never falls back to Alice's key.
    assert.equal(ref.current?.exportPrivateKey(bob?.id ?? ''), 'bb'.repeat(32))
  })

  it('rejects unknown accounts', async () => {
    // Scenario: callers must provide an account id that exists in the unlocked vault.
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })

    // Expected result: invalid ids fail instead of returning an arbitrary secret.
    assert.throws(() => ref.current?.exportPrivateKey('missing'), /unknown account/i)
  })
})
