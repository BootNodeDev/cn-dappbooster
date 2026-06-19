import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Copyable } from '@/components/ui/Copyable'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { JsonField } from '@/components/utils/JsonField'
import { createContract as defaultCreateContract } from '@/ledger/contracts'
import { parseJsonObject } from '@/utils/json'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

interface CreateContractUtilProps {
  account: AccountPublic
  createContract?: typeof defaultCreateContract
}

// Submits one generic CreateCommand and surfaces the resulting update id for copying.
export const CreateContractUtil = ({
  account,
  createContract = defaultCreateContract,
}: CreateContractUtilProps): JSX.Element => {
  const vault = useVault()
  const [templateId, setTemplateId] = useState('')
  const [json, setJson] = useState('{}')
  const [jsonValid, setJsonValid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [updateId, setUpdateId] = useState<string | undefined>()

  const onSubmit = async (): Promise<void> => {
    const trimmed = templateId.trim()
    if (trimmed === '') {
      setError('Template ID is required')
      return
    }
    setBusy(true)
    setError(undefined)
    setUpdateId(undefined)
    try {
      const createArguments = parseJsonObject(json, 'Create arguments')
      const result = await createContract({
        account,
        templateId: trimmed,
        createArguments,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setUpdateId(result.updateId)
      toast.success('Contract created')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <label
        htmlFor="create-template-id"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Template ID
        <TextInput
          id="create-template-id"
          value={templateId}
          onChange={(event) => setTemplateId(event.currentTarget.value)}
          placeholder="package:Module:Template"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <JsonField
        id="create-arguments-json"
        label="Create arguments JSON"
        value={json}
        onChange={setJson}
        onValidityChange={setJsonValid}
      />
      {error === undefined ? null : <Alert variant="error">{error}</Alert>}
      {updateId === undefined ? null : (
        <div className="flex items-center justify-between gap-2 rounded-md border border-success/40 bg-success-soft px-3 py-2">
          <div className="min-w-0">
            <div className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
              Update ID
            </div>
            <div className="break-all font-mono text-[0.82rem] text-foreground">{updateId}</div>
          </div>
          <Copyable
            value={updateId}
            label="update ID"
          />
        </div>
      )}
      <PrimaryButton
        type="submit"
        className="w-full"
        disabled={busy || !jsonValid}
      >
        {busy ? 'Creating...' : 'Create contract'}
      </PrimaryButton>
    </form>
  )
}
