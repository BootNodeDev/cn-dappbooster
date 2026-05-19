import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { loadAutoLockOption } from '@/vault/storage.ts'
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

describe('VaultContext.autoLockOption', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    localStorage.clear()
  })

  it('defaults to "never"', () => {
    const { ref } = captureVault()
    assert.equal(ref.current?.autoLockOption, 'never')
  })

  it('setAutoLockOption updates context and persists', () => {
    const { ref } = captureVault()
    act(() => {
      ref.current?.setAutoLockOption('5m')
    })
    assert.equal(ref.current?.autoLockOption, '5m')
    assert.equal(loadAutoLockOption(), '5m')
  })

  it('initialises from persisted value on mount', () => {
    localStorage.setItem('carpincho.autoLockOption', '1h')
    const { ref } = captureVault()
    assert.equal(ref.current?.autoLockOption, '1h')
  })
})
