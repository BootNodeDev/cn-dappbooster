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

describe('VaultContext.verifyPassword', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('returns true for the unlocked password and false for anything else', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    assert.equal(ref.current?.verifyPassword('correct-horse-battery'), true)
    assert.equal(ref.current?.verifyPassword('wrong'), false)
    assert.equal(ref.current?.verifyPassword(''), false)
  })

  it('returns false while locked', async () => {
    const { ref } = captureVault()
    await act(async () => {
      await ref.current?.setup('correct-horse-battery')
    })
    act(() => {
      ref.current?.lock()
    })
    assert.equal(ref.current?.verifyPassword('correct-horse-battery'), false)
  })
})
