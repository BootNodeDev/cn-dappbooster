# Carpincho Private Key Import/Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Settings flows to import a party private key and export the selected party private key.

**Architecture:** Keep normal account projections secret-free. Add a deliberate vault secret accessor for export, derive the public key from imported Ed25519 private keys in `vault/keypair.ts`, and render two new drawer leaves under Settings.

**Tech Stack:** React 18, TypeScript, Radix-backed local Sheet/menu primitives, Node `node:test`, React Testing Library, `@noble/ed25519`.

---

### Task 1: Keypair Import Helper

**Files:**
- Modify: `carpincho-wallet/src/vault/keypair.ts`
- Test: `carpincho-wallet/test/vault/keypair.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { derivePublicKeyBase64, generateKeypair, signMessageBase64 } from '@/vault/keypair'

describe('derivePublicKeyBase64', () => {
  it('derives the public key for an imported private key', async () => {
    // Scenario: an imported party only provides the private key, so the wallet derives the
    // public key needed by provider payloads from that exact private key.
    const keypair = await generateKeypair()
    const derived = await derivePublicKeyBase64(keypair.privateKeyHex)

    // Expected result: the derived public key matches the public key generated with the keypair.
    assert.equal(derived, keypair.publicKeyBase64)
  })

  it('rejects malformed imported private keys before vault mutation', async () => {
    // Scenario: import should fail before addAccount when the private key is not valid Ed25519 hex.
    await assert.rejects(() => derivePublicKeyBase64('not-hex'), /invalid private key/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix carpincho-wallet test -- test/vault/keypair.test.ts`
Expected: FAIL because `derivePublicKeyBase64` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
export const derivePublicKeyBase64 = async (privateKeyHex: string): Promise<string> => {
  try {
    const publicKey = await ed.getPublicKeyAsync(fromHex(privateKeyHex.trim()))
    return toBase64(publicKey)
  } catch {
    throw new Error('invalid private key')
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix carpincho-wallet test -- test/vault/keypair.test.ts`
Expected: PASS.

### Task 2: Vault Secret Export API

**Files:**
- Modify: `carpincho-wallet/src/vault/VaultContext.tsx`
- Test: `carpincho-wallet/test/vault/exportPrivateKey.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { act, cleanup, render } from '@testing-library/react'
import { VaultProvider, type VaultContextValue } from '@/vault/VaultContext'
import { useVault } from '@/vault/useVault'

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

describe('VaultContext.exportPrivateKey', () => {
  beforeEach(() => localStorage.clear())
  afterEach(() => {
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

    // Expected result: exporting Bob returns Bob's key and never leaks Alice's key by default.
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix carpincho-wallet test -- test/vault/exportPrivateKey.test.tsx`
Expected: FAIL because `exportPrivateKey` is absent.

- [ ] **Step 3: Write minimal implementation**

```ts
exportPrivateKey: (accountId: string) => string

const exportPrivateKey = useCallback((accountId: string): string => {
  if (unlockedPlaintext === null) {
    throw new Error('vault locked')
  }
  const acct = unlockedPlaintext.accounts.find((a) => a.id === accountId)
  if (acct === undefined) {
    throw new Error(`unknown account: ${accountId}`)
  }
  return acct.privateKeyHex
}, [])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix carpincho-wallet test -- test/vault/exportPrivateKey.test.tsx`
Expected: PASS.

### Task 3: Settings Import/Export Screens

**Files:**
- Create: `carpincho-wallet/src/components/PrivateKeyPanel.tsx`
- Modify: `carpincho-wallet/src/components/menu/screens.ts`
- Modify: `carpincho-wallet/src/components/menu/MenuSheet.tsx`
- Test: `carpincho-wallet/test/components/PrivateKeyPanel.test.tsx`
- Test: `carpincho-wallet/test/components/MenuSheet.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
it('settings includes import and export private key entries', async () => {
  // Scenario: private key actions are Settings-level menu items.
  const user = userEvent.setup()
  render(wrap(baseVault(), <MenuSheet open={true} onOpenChange={() => undefined} />))
  await user.click(screen.getByRole('button', { name: /^settings$/i }))

  // Expected result: both rows are visible from Settings.
  assert.ok(screen.getByRole('button', { name: /^import private key$/i }))
  assert.ok(screen.getByRole('button', { name: /^export private key$/i }))
})
```

```tsx
it('imports a private key as a vault account', async () => {
  // Scenario: a user imports an existing party with a private key instead of creating a party.
  const user = userEvent.setup()
  const keypair = await generateKeypair()
  const added: Array<{ name: string; partyId: string; privateKeyHex: string; publicKeyBase64: string }> = []
  renderWithVault(
    {
      addAccount: async (args) => {
        added.push(args)
        return {
          id: 'imported',
          name: args.name,
          partyId: args.partyId,
          publicKeyBase64: args.publicKeyBase64,
          network: args.network,
          isPrimary: false,
          createdAt: 1,
        }
      },
    },
    <ImportPrivateKeyForm />,
  )

  await user.type(screen.getByLabelText(/^party id$/i), 'alice::fingerprint')
  await user.type(screen.getByLabelText(/^party name$/i), 'alice')
  await user.type(screen.getByLabelText(/^private key$/i), keypair.privateKeyHex)
  await user.click(screen.getByRole('button', { name: /^import private key$/i }))

  await waitFor(() => assert.equal(added.length, 1))
  assert.equal(added[0]?.publicKeyBase64, keypair.publicKeyBase64)
})
```

```tsx
it('shows and copies the selected account private key', async () => {
  // Scenario: export reveals the selected party key directly while the vault is unlocked.
  const user = userEvent.setup()
  const copied: string[] = []
  Object.assign(navigator, { clipboard: { writeText: async (value: string) => copied.push(value) } })
  renderWithVault(
    {
      primary: {
        id: 'alice',
        name: 'alice',
        partyId: 'alice::party',
        publicKeyBase64: 'public',
        network: 'localnet',
        isPrimary: true,
        createdAt: 1,
      },
      exportPrivateKey: () => 'aa'.repeat(32),
    },
    <ExportPrivateKeyView />,
  )

  assert.ok(screen.getByText('aa'.repeat(32)))
  await user.click(screen.getByRole('button', { name: /^copy private key$/i }))
  assert.deepEqual(copied, ['aa'.repeat(32)])
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm --prefix carpincho-wallet test -- test/components/MenuSheet.test.tsx test/components/PrivateKeyPanel.test.tsx`
Expected: FAIL because menu rows and components do not exist.

- [ ] **Step 3: Write minimal implementation**

Add `import-private-key` and `export-private-key` screens to `screens.ts`, render `ImportPrivateKeyForm` and `ExportPrivateKeyView` from `MenuSheet.tsx`, and create `PrivateKeyPanel.tsx` with the form and export view.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm --prefix carpincho-wallet test -- test/components/MenuSheet.test.tsx test/components/PrivateKeyPanel.test.tsx`
Expected: PASS.

### Task 4: Validation

**Files:**
- All changed `carpincho-wallet` files

- [ ] **Step 1: Run focused tests**

Run: `npm --prefix carpincho-wallet test -- test/vault/keypair.test.ts test/vault/exportPrivateKey.test.tsx test/components/MenuSheet.test.tsx test/components/PrivateKeyPanel.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run project checks**

Run: `npm --prefix carpincho-wallet run lint`
Expected: PASS.

Run: `npm --prefix carpincho-wallet test`
Expected: PASS.

- [ ] **Step 3: Commit semantic implementation changes**

```bash
git add carpincho-wallet/src carpincho-wallet/test docs/superpowers/plans/2026-06-13-carpincho-private-key-import-export.md
git commit -m "feat(carpincho-wallet): add private key import export"
```
