import { strict as assert } from 'node:assert'
import { afterEach, describe, it } from 'node:test'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExportPrivateKeyView, ImportPrivateKeyForm } from '@/components/PrivateKeyPanel'
import { getToastEntries, toast } from '@/components/ui/toast'
import { derivePublicKeyBase64, generateKeypair } from '@/vault/keypair'
import type { AccountPublic } from '@/vault/types'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext'

const originalFetch = globalThis.fetch
const originalClipboard = navigator.clipboard

const PRIMARY_ACCOUNT: AccountPublic = {
  // Active account fixture represents the selected party whose secret is exported.
  id: 'alice-account',
  name: 'alice',
  partyId: 'alice::party',
  publicKeyBase64: 'alice-public',
  network: 'localnet',
  isPrimary: true,
  createdAt: 1,
}

// Builds a complete vault context so each component test overrides only the behavior it asserts.
const baseVault = (overrides: Partial<VaultContextValue> = {}): VaultContextValue => ({
  isLocked: false,
  isLoading: false,
  hasVault: true,
  setup: async () => undefined,
  unlock: async () => undefined,
  lock: () => undefined,
  destroyVault: () => undefined,
  accounts: [PRIMARY_ACCOUNT],
  primary: PRIMARY_ACCOUNT,
  transactions: [],
  setPrimary: async () => undefined,
  addAccount: async () => PRIMARY_ACCOUNT,
  removeAccount: async () => undefined,
  exportPrivateKey: () => '',
  signMessage: async () => '',
  recordTransaction: async () => ({}) as unknown as import('@/vault/types').TransactionRecord,
  changePassword: async () => undefined,
  verifyPassword: () => false,
  autoLockOption: 'never',
  setAutoLockOption: () => undefined,
  ...overrides,
})

// Renders private-key screens with a vault provider because both screens use the real vault hook.
const renderWithVault = (overrides: Partial<VaultContextValue>, ui: JSX.Element): void => {
  render(<VaultContext.Provider value={baseVault(overrides)}>{ui}</VaultContext.Provider>)
}

// Private-key import form tests cover validation and vault persistence inputs.
describe('ImportPrivateKeyForm', () => {
  afterEach(() => {
    // Cleanup: reset globals and transient toast state between form scenarios.
    cleanup()
    toast.clear()
    globalThis.fetch = originalFetch
  })

  it('requires party id, party name, and private key before importing', async () => {
    // Scenario: empty import fields should not mutate the vault.
    const user = userEvent.setup()
    const added: unknown[] = []
    renderWithVault(
      {
        addAccount: async (args) => {
          added.push(args)
          return PRIMARY_ACCOUNT
        },
      },
      <ImportPrivateKeyForm />,
    )

    // Action: submit the untouched form.
    await user.click(screen.getByRole('button', { name: /^import private key$/i }))

    // Expected result: a field-level error is shown and addAccount is not called.
    assert.ok(screen.getByText(/all fields are required/i))
    assert.equal(added.length, 0)
  })

  it('imports a private key as a vault account with a derived public key', async () => {
    // Scenario: existing Canton parties are imported with a party id, display name, and secret key.
    const user = userEvent.setup()
    const keypair = await generateKeypair()
    const expectedPublicKey = await derivePublicKeyBase64(keypair.privateKeyHex)
    const added: Array<{
      name: string
      partyId: string
      privateKeyHex: string
      publicKeyBase64: string
      network: string
    }> = []
    globalThis.fetch = (async (input, init) => {
      const url = String(input)
      if (url.endsWith('/rpc') && String(init?.body ?? '').includes('"method":"status"')) {
        // Setup: imported accounts use the same wallet-service network source as created accounts.
        return new Response(
          JSON.stringify({
            result: {
              network: { networkId: 'canton:from-status' },
            },
          }),
          { status: 200 },
        )
      }
      throw new Error(`unexpected request: ${url}`)
    }) as typeof globalThis.fetch
    renderWithVault(
      {
        addAccount: async (args) => {
          // Assertion fixture: capture the exact account data that would be encrypted in the vault.
          added.push(args)
          return {
            id: 'imported-account',
            name: args.name,
            partyId: args.partyId,
            publicKeyBase64: args.publicKeyBase64,
            network: args.network,
            isPrimary: false,
            createdAt: 2,
          }
        },
      },
      <ImportPrivateKeyForm />,
    )

    // Action: fill the three requested import fields and submit.
    await user.type(screen.getByLabelText(/^party id$/i), 'alice::fingerprint')
    await user.type(screen.getByLabelText(/^party name$/i), 'alice')
    await user.type(screen.getByLabelText(/^private key$/i), keypair.privateKeyHex)
    await user.click(screen.getByRole('button', { name: /^import private key$/i }))

    // Expected result: addAccount receives the trimmed values, current network, and derived public key.
    await waitFor(() => assert.equal(added.length, 1))
    assert.deepEqual(added[0], {
      name: 'alice',
      partyId: 'alice::fingerprint',
      privateKeyHex: keypair.privateKeyHex,
      publicKeyBase64: expectedPublicKey,
      network: 'canton:from-status',
    })
    assert.equal(getToastEntries()[0]?.message, 'Private key imported.')
  })
})

// Private-key export tests cover direct reveal for the selected account.
describe('ExportPrivateKeyView', () => {
  afterEach(() => {
    // Cleanup: reset DOM, toast state, and the clipboard shim after export scenarios.
    cleanup()
    toast.clear()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
  })

  it('shows and copies the selected account private key', async () => {
    // Scenario: the user exports the currently selected party without a password re-check.
    const user = userEvent.setup()
    const copied: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copied.push(value)
        },
      },
    })
    const privateKey = 'aa'.repeat(32)
    renderWithVault(
      {
        exportPrivateKey: (accountId) => {
          assert.equal(accountId, PRIMARY_ACCOUNT.id)
          return privateKey
        },
      },
      <ExportPrivateKeyView />,
    )

    // Expected setup state: account context and secret key are visible in the export screen.
    assert.ok(screen.getByText(PRIMARY_ACCOUNT.name))
    assert.ok(screen.getByText(PRIMARY_ACCOUNT.partyId))
    assert.ok(screen.getByText(privateKey))

    // Action: copy the visible private key through the explicit copy control.
    await user.click(screen.getByRole('button', { name: /^copy private key$/i }))

    // Expected result: the copied value is exactly the selected party private key.
    await waitFor(() => assert.deepEqual(copied, [privateKey]))
  })

  it('shows an empty state when no account is selected', () => {
    // Scenario: export is unavailable until the wallet has a selected account.
    renderWithVault({ accounts: [], primary: null }, <ExportPrivateKeyView />)

    // Expected result: no secret is requested or shown.
    assert.ok(screen.getByText(/no selected account/i))
  })
})
