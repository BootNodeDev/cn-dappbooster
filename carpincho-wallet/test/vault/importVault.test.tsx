import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { generateKeypair } from '@/vault/keypair'
import type { VaultEnvelope } from '@/vault/types'
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

const envelopeOf = (accounts: VaultEnvelope['accounts']): VaultEnvelope => ({ v: 1, accounts })

describe('VaultContext.importVault', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('imports valid entries and reports counts, using the envelope network', async () => {
    const kp = await generateKeypair()
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })

    let result: { imported: number; skipped: number; rejected: number } | undefined
    await act(async () => {
      result = await ref.current?.importVault(
        envelopeOf([
          {
            name: 'alice',
            partyId: 'alice::ns',
            publicKeyBase64: kp.publicKeyBase64,
            privateKeyHex: kp.privateKeyHex,
            network: 'devnet',
          },
        ]),
      )
    })

    assert.deepEqual(result, { imported: 1, skipped: 0, rejected: 0 })
    const alice = ref.current?.accounts.find((a) => a.name === 'alice')
    assert.equal(alice?.network, 'devnet')
    assert.equal(alice?.partyId, 'alice::ns')
  })

  it('rejects entries whose key does not derive the stored public key', async () => {
    const kp = await generateKeypair()
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })

    let result: { imported: number; skipped: number; rejected: number } | undefined
    await act(async () => {
      result = await ref.current?.importVault(
        envelopeOf([
          {
            name: 'eve',
            partyId: 'eve::ns',
            publicKeyBase64: 'not-the-matching-key',
            privateKeyHex: kp.privateKeyHex,
            network: 'localnet',
          },
        ]),
      )
    })

    assert.deepEqual(result, { imported: 0, skipped: 0, rejected: 1 })
    assert.equal(ref.current?.accounts.length, 0)
  })

  it('rejects malformed partyIds and skips duplicates', async () => {
    const good = await generateKeypair()
    const bad = await generateKeypair()
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
      await ref.current?.addAccount({
        name: 'alice',
        partyId: 'alice::ns',
        network: 'localnet',
        privateKeyHex: good.privateKeyHex,
        publicKeyBase64: good.publicKeyBase64,
      })
    })

    let result: { imported: number; skipped: number; rejected: number } | undefined
    await act(async () => {
      result = await ref.current?.importVault(
        envelopeOf([
          {
            name: 'alice',
            partyId: 'alice::ns',
            publicKeyBase64: good.publicKeyBase64,
            privateKeyHex: good.privateKeyHex,
            network: 'localnet',
          },
          {
            name: 'nocolons',
            partyId: 'nocolons',
            publicKeyBase64: bad.publicKeyBase64,
            privateKeyHex: bad.privateKeyHex,
            network: 'localnet',
          },
        ]),
      )
    })

    assert.deepEqual(result, { imported: 0, skipped: 1, rejected: 1 })
  })

  it('rejects entries whose required fields are not strings', async () => {
    const good = await generateKeypair()
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })

    let result: { imported: number; skipped: number; rejected: number } | undefined
    await act(async () => {
      result = await ref.current?.importVault(
        envelopeOf([
          null as unknown as never,
          {
            name: 42 as unknown as string,
            partyId: 'alice::ns',
            publicKeyBase64: good.publicKeyBase64,
            privateKeyHex: good.privateKeyHex,
            network: 'localnet',
          },
        ]),
      )
    })

    assert.deepEqual(result, { imported: 0, skipped: 0, rejected: 2 })
    assert.equal(ref.current?.accounts.length, 0)
  })

  it('throws on a malformed envelope', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    await assert.rejects(
      () =>
        ref.current?.importVault({ v: 2, accounts: [] } as unknown as VaultEnvelope) ??
        Promise.resolve(),
      /unsupported vault envelope/i,
    )
  })
})
