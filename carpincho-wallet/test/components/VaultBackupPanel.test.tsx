import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { getToastEntries, toast } from '@/components/ui/toast'
import { ExportVaultView, ImportVaultForm } from '@/components/VaultBackupPanel'
import type { VaultEnvelope } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue =>
  ({
    isLocked: false,
    isLoading: false,
    hasVault: true,
    setup: async () => undefined,
    unlock: async () => undefined,
    lock: () => undefined,
    destroyVault: async () => undefined,
    accounts: [],
    primary: null,
    transactions: [],
    setPrimary: async () => undefined,
    addAccount: async () => ({
      id: '',
      name: '',
      partyId: '',
      publicKeyBase64: '',
      network: '',
      isPrimary: false,
      createdAt: 0,
    }),
    removeAccount: async () => undefined,
    exportVault: () => ({ v: 1, accounts: [] }) as VaultEnvelope,
    importVault: async () => ({ imported: 0, skipped: 0, rejected: 0 }),
    signMessage: async () => '',
    recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
    changePassword: async () => undefined,
    verifyPassword: () => false,
    autoLockOption: 'never',
    setAutoLockOption: () => undefined,
    ...overrides,
  }) as VaultContextValue

const renderWithVault = (overrides: Partial<VaultContextValue>, ui: ReactNode): void => {
  render(
    <TooltipProvider>
      <VaultContext.Provider value={baseVault(overrides)}>{ui}</VaultContext.Provider>
    </TooltipProvider>,
  )
}

describe('ExportVaultView', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('reveals the envelope JSON only after a correct password', async () => {
    const user = userEvent.setup()
    const envelope: VaultEnvelope = {
      v: 1,
      accounts: [
        {
          name: 'alice',
          partyId: 'alice::ns',
          publicKeyBase64: 'pub',
          privateKeyHex: 'aa',
          network: 'localnet',
        },
      ],
    }
    renderWithVault(
      { verifyPassword: () => true, exportVault: () => envelope },
      <ExportVaultView />,
    )
    assert.equal(screen.queryByRole('button', { name: /copy json/i }), null)
    await user.type(screen.getByLabelText(/confirm password/i), 'right-right-1')
    await user.click(screen.getByRole('button', { name: /reveal/i }))
    // The reveal view (JsonView + Copy/Download) only mounts after a correct password.
    await waitFor(() => assert.ok(screen.getByRole('button', { name: /copy json/i })))
  })
})

describe('ImportVaultForm', () => {
  afterEach(() => {
    toast.clear()
    cleanup()
  })

  it('parses pasted JSON, calls importVault, and toasts the counts', async () => {
    const user = userEvent.setup()
    const calls: VaultEnvelope[] = []
    renderWithVault(
      {
        importVault: async (env) => {
          calls.push(env)
          return { imported: 2, skipped: 1, rejected: 0 }
        },
      },
      <ImportVaultForm />,
    )
    const envelope: VaultEnvelope = {
      v: 1,
      accounts: [
        {
          name: 'a',
          partyId: 'a::ns',
          publicKeyBase64: 'p',
          privateKeyHex: 'aa',
          network: 'localnet',
        },
      ],
    }
    // userEvent escapes braces; use fireEvent.change to drive the controlled textarea value.
    const textarea = screen.getByLabelText(/vault json/i) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: JSON.stringify(envelope) } })
    await user.click(screen.getByRole('button', { name: /^import vault$/i }))
    await waitFor(() => assert.equal(calls.length, 1))
    const entries = getToastEntries()
    assert.ok(entries.some((e) => typeof e.message === 'string' && /imported 2/i.test(e.message)))
  })

  it('toasts an error for invalid JSON and does not call importVault', async () => {
    const user = userEvent.setup()
    let called = 0
    renderWithVault(
      {
        importVault: async () => {
          called += 1
          return { imported: 0, skipped: 0, rejected: 0 }
        },
      },
      <ImportVaultForm />,
    )
    const textarea = screen.getByLabelText(/vault json/i) as HTMLTextAreaElement
    // Native input event does not drive React's controlled onChange; use fireEvent.change.
    fireEvent.change(textarea, { target: { value: 'not json' } })
    await user.click(screen.getByRole('button', { name: /^import vault$/i }))
    assert.equal(called, 0)
    assert.ok(
      getToastEntries().some(
        (e) => typeof e.message === 'string' && /invalid json/i.test(e.message),
      ),
    )
  })
})
