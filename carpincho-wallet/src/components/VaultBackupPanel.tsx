import { type FormEvent, useState } from 'react'
import { ConfirmPasswordForm } from '@/components/ConfirmPasswordForm'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { COPY_ICON } from '@/components/ui/icons'
import { JsonView } from '@/components/ui/JsonView'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import { INPUT_CLASS } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { copyText } from '@/utils/clipboard'
import { cn } from '@/utils/cn'
import { downloadJson } from '@/utils/download'
import type { VaultEnvelope } from '@/vault/types'
import { useVault } from '@/vault/useVault'

const backupFilename = (): string => {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
  return `carpincho-vault-${stamp}.json`
}

// Reveals a backup of every account only after a fresh password re-check. The plaintext
// envelope lives in state ONLY while this view is mounted; navigating away drops it.
export const ExportVaultView = (): JSX.Element => {
  const v = useVault()
  const [envelope, setEnvelope] = useState<VaultEnvelope | null>(null)

  if (envelope === null) {
    return (
      <ConfirmPasswordForm
        label="Confirm password"
        submitLabel="Reveal vault backup"
        onVerified={() => setEnvelope(v.exportVault())}
      >
        <p className="text-[0.85rem] text-muted-foreground">
          Confirm your password to reveal a backup of every account in this vault, including their
          private keys.
        </p>
      </ConfirmPasswordForm>
    )
  }

  const onDownload = (): void => {
    try {
      downloadJson(backupFilename(), envelope)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <JsonView value={envelope} />
      <div className="flex gap-3">
        <SecondaryButton
          onClick={() => copyText(JSON.stringify(envelope, null, 2), 'Vault backup copied.')}
        >
          {COPY_ICON}
          Copy JSON
        </SecondaryButton>
        <SecondaryButton onClick={onDownload}>Download JSON</SecondaryButton>
      </div>
    </div>
  )
}

interface ImportVaultFormProps {
  onImported?: () => void
}

// Restores accounts from a pasted or uploaded envelope. No password gate: the vault
// is already unlocked and the user is adding their own keys.
export const ImportVaultForm = ({ onImported }: ImportVaultFormProps): JSX.Element => {
  const v = useVault()
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const runImport = async (raw: string): Promise<void> => {
    let envelope: VaultEnvelope
    try {
      envelope = JSON.parse(raw) as VaultEnvelope
    } catch {
      toast.error('Invalid JSON.')
      return
    }
    setBusy(true)
    try {
      const r = await v.importVault(envelope)
      toast.success(`Imported ${r.imported}, skipped ${r.skipped}, rejected ${r.rejected}.`)
      onImported?.()
    } catch (err) {
      toast.error(`Import vault failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  const onPasteSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    void runImport(text)
  }

  const onUploadSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (file === null) {
      toast.warning('Choose a JSON file.')
      return
    }
    await runImport(await file.text())
  }

  return (
    <Tabs defaultValue="paste">
      <TabsList className="mb-4">
        <TabTrigger value="paste">Paste</TabTrigger>
        <TabTrigger value="upload">Upload file</TabTrigger>
      </TabsList>
      <TabContent value="paste">
        <form
          onSubmit={onPasteSubmit}
          className="flex flex-col gap-4"
        >
          <label
            htmlFor="import-vault-json"
            className="sr-only"
          >
            Vault JSON
          </label>
          <textarea
            id="import-vault-json"
            className={cn(INPUT_CLASS, 'min-h-40 resize-y font-mono text-[0.82rem]')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder='{"v":1,"accounts":[...]}'
            spellCheck={false}
          />
          <PrimaryButton
            type="submit"
            disabled={busy || text.trim() === ''}
          >
            {busy ? 'Importing...' : 'Import vault'}
          </PrimaryButton>
        </form>
      </TabContent>
      <TabContent value="upload">
        <form
          onSubmit={onUploadSubmit}
          className="flex flex-col gap-4"
        >
          <input
            id="import-vault-file"
            type="file"
            accept=".json,application/json"
            aria-label="Vault JSON file"
            className="sr-only"
            onChange={(e) => setFile(e.currentTarget.files?.[0] ?? null)}
          />
          <label
            htmlFor="import-vault-file"
            className="cursor-pointer rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center hover:border-primary/60"
          >
            {file === null ? (
              <span className="text-[0.82rem] font-medium text-muted-foreground">
                Drop a .json file or click to choose.
              </span>
            ) : (
              <span className="rounded-sm bg-muted px-2 py-1 font-mono text-[0.82rem] text-foreground">
                {file.name}
              </span>
            )}
          </label>
          <PrimaryButton
            type="submit"
            disabled={busy || file === null}
          >
            {busy ? 'Importing...' : 'Import vault'}
          </PrimaryButton>
        </form>
      </TabContent>
    </Tabs>
  )
}
