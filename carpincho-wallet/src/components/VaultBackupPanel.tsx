import { type FormEvent, useState } from 'react'
import { ConfirmPasswordForm } from '@/components/ConfirmPasswordForm'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { FileDropInput } from '@/components/ui/FileDropInput'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { toast } from '@/components/ui/toast'
import { downloadJson } from '@/utils/download'
import type { CarpinchoBackup } from '@/vault/types'
import { useVault } from '@/vault/useVault'

const ENCRYPTED_BANNER =
  'This file is encrypted with the password of the vault it was exported from.'

const backupFilename = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  return `carpincho-backup-${stamp}.json`
}

// Confirms the vault password, encrypts a backup of every account under it, then offers
// a single download. The encrypted container is safe to hold in state (no plaintext keys).
export const ExportVaultView = (): JSX.Element => {
  const v = useVault()
  const [backup, setBackup] = useState<CarpinchoBackup | null>(null)

  const onVerified = (password: string): void => {
    void (async () => {
      try {
        setBackup(await v.exportEncryptedVault(password))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Export failed.')
      }
    })()
  }

  if (backup === null) {
    return (
      <ConfirmPasswordForm
        label="Confirm password"
        submitLabel="Encrypt backup"
        onVerified={onVerified}
      >
        <Alert variant="info">{ENCRYPTED_BANNER}</Alert>
        <p className="text-[0.85rem] text-muted-foreground">
          This is the password used to encrypt your file. You'll need it to import.
        </p>
      </ConfirmPasswordForm>
    )
  }

  const onDownload = (): void => {
    try {
      downloadJson(backupFilename(), backup)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="success">Encrypted backup ready.</Alert>
      <SecondaryButton onClick={onDownload}>Download backup</SecondaryButton>
    </div>
  )
}

interface ImportVaultFormProps {
  onImported?: () => void
}

// Restores accounts from an encrypted backup file. Decryption (with the file's password)
// is the gate; the per-entry validation inside importEncryptedVault is defense-in-depth.
export const ImportVaultForm = ({ onImported }: ImportVaultFormProps): JSX.Element => {
  const v = useVault()
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (file === null) {
      toast.warning('Choose a backup file.')
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(await file.text())
    } catch {
      toast.error('Invalid file.')
      return
    }
    setBusy(true)
    try {
      const r = await v.importEncryptedVault(parsed, password)
      toast.success(`Imported ${r.imported}, skipped ${r.skipped}, rejected ${r.rejected}.`)
      // Only leave the screen when something landed; otherwise stay so the counts remain readable.
      if (r.imported > 0) {
        onImported?.()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-4"
    >
      <Alert variant="info">{ENCRYPTED_BANNER}</Alert>
      <FileDropInput
        id="import-vault-file"
        accept=".json,application/json"
        ariaLabel="Backup file"
        prompt="Drop a .json backup or click to choose."
        fileName={file?.name ?? null}
        onSelect={setFile}
      />
      <div>
        <label htmlFor="import-vault-password">Backup password</label>
        <PasswordInput
          id="import-vault-password"
          autoComplete="off"
          placeholder="Backup password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          Enter the password you used when you exported this file.
        </p>
      </div>
      <PrimaryButton
        type="submit"
        disabled={busy || file === null || password === ''}
      >
        {busy ? 'Importing...' : 'Import backup'}
      </PrimaryButton>
    </form>
  )
}
