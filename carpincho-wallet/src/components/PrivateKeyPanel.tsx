import { type FormEvent, useState } from 'react'
import { getWalletServiceNetworkId } from '@/api/walletService'
import { ConfirmPasswordForm } from '@/components/ConfirmPasswordForm'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { COPY_ICON } from '@/components/ui/icons'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { copySecret } from '@/utils/clipboard'
import { derivePublicKeyBase64 } from '@/vault/keypair'
import { useVault } from '@/vault/useVault'

interface ImportPrivateKeyFormProps {
  onImported?: () => void
}

interface ImportState {
  partyId: string
  partyName: string
  privateKey: string
}

const EMPTY_IMPORT_STATE: ImportState = {
  partyId: '',
  partyName: '',
  privateKey: '',
}

// Imports an existing Canton party by storing its supplied secret in the encrypted vault.
export const ImportPrivateKeyForm = ({ onImported }: ImportPrivateKeyFormProps): JSX.Element => {
  const v = useVault()
  const [state, setState] = useState<ImportState>(EMPTY_IMPORT_STATE)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onChange = (field: keyof ImportState, value: string): void => {
    setState((current) => ({ ...current, [field]: value }))
    setError(null)
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const partyId = state.partyId.trim()
    const name = state.partyName.trim()
    const privateKeyHex = state.privateKey.trim().toLowerCase()
    if (partyId === '' || name === '' || privateKeyHex === '') {
      setError('All fields are required.')
      return
    }

    setBusy(true)
    try {
      const publicKeyBase64 = await derivePublicKeyBase64(privateKeyHex)
      const network = await getWalletServiceNetworkId()
      await v.addAccount({
        name,
        partyId,
        privateKeyHex,
        publicKeyBase64,
        network,
      })
      setState(EMPTY_IMPORT_STATE)
      toast.success('Private key imported.')
      onImported?.()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed.'
      setError(message)
      toast.error(`Import private key failed: ${message}`)
    } finally {
      setBusy(false)
    }
  }

  const hasError = error !== null

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <div>
        <label htmlFor="import-party-id">Party ID</label>
        <TextInput
          id="import-party-id"
          type="text"
          className="font-mono"
          value={state.partyId}
          onChange={(event) => onChange('partyId', event.target.value)}
          placeholder="alice::fingerprint"
          error={hasError && state.partyId.trim() === ''}
          aria-errormessage={hasError ? 'import-private-key-error' : undefined}
        />
      </div>
      <div>
        <label htmlFor="import-party-name">Party name</label>
        <TextInput
          id="import-party-name"
          type="text"
          value={state.partyName}
          onChange={(event) => onChange('partyName', event.target.value)}
          placeholder="alice"
          error={hasError && state.partyName.trim() === ''}
          aria-errormessage={hasError ? 'import-private-key-error' : undefined}
        />
      </div>
      <div>
        <label htmlFor="import-private-key">Private key</label>
        <PasswordInput
          id="import-private-key"
          className="font-mono"
          value={state.privateKey}
          onChange={(event) => onChange('privateKey', event.target.value)}
          placeholder="64-character Ed25519 private key"
          autoComplete="off"
          error={hasError && state.privateKey.trim() === ''}
          aria-errormessage={hasError ? 'import-private-key-error' : undefined}
        />
      </div>
      {hasError && (
        <p
          id="import-private-key-error"
          className="text-[0.85rem] text-danger"
        >
          {error}
        </p>
      )}
      <PrimaryButton
        type="submit"
        disabled={busy}
      >
        {busy ? 'Importing...' : 'Import private key'}
      </PrimaryButton>
    </form>
  )
}

// Reveals the selected party secret only after a fresh password re-check, even though
// the vault is already unlocked, so an unattended popup cannot leak the raw key.
export const ExportPrivateKeyView = (): JSX.Element => {
  const v = useVault()
  const account = v.primary
  const [revealed, setRevealed] = useState(false)

  if (account === null) {
    return (
      <p className="rounded-md border border-border bg-muted p-3 text-[0.92rem] text-muted-foreground">
        No selected account.
      </p>
    )
  }

  const accountSummary = (
    <div className="rounded-md border border-border bg-muted p-3">
      <p className="font-semibold text-foreground">{account.name}</p>
      <p className="mt-1 break-all font-mono text-[0.82rem] text-muted-foreground">
        {account.partyId}
      </p>
    </div>
  )

  if (!revealed) {
    return (
      <ConfirmPasswordForm
        label="Confirm password"
        submitLabel="Reveal private key"
        onVerified={() => setRevealed(true)}
      >
        {accountSummary}
        <p className="text-[0.85rem] text-muted-foreground">
          Confirm your password to reveal this account's private key.
        </p>
      </ConfirmPasswordForm>
    )
  }

  let privateKey: string
  try {
    privateKey = v.exportPrivateKey(account.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Private key unavailable.'
    return <p className="text-[0.9rem] text-danger">{message}</p>
  }

  return (
    <div className="flex flex-col gap-4">
      {accountSummary}
      <div>
        <p className="mb-2 text-[0.85rem] font-semibold text-muted-foreground">Private key</p>
        <p className="max-h-40 overflow-y-auto break-all rounded-md border border-border-strong bg-surface p-3 font-mono text-[0.82rem] text-foreground">
          {privateKey}
        </p>
      </div>
      <SecondaryButton
        onClick={() => copySecret(privateKey, 'Private key copied. Clipboard clears in 60s.')}
      >
        {COPY_ICON}
        Copy private key
      </SecondaryButton>
    </div>
  )
}
