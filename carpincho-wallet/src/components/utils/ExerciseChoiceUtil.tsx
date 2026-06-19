import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Copyable } from '@/components/ui/Copyable'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { JsonField } from '@/components/utils/JsonField'
import { exerciseContract as defaultExerciseContract } from '@/ledger/contracts'
import { parseJsonObject } from '@/utils/json'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

interface ExerciseChoiceUtilProps {
  account: AccountPublic
  exerciseContract?: typeof defaultExerciseContract
}

// Submits one generic ExerciseCommand and surfaces the resulting update id for copying.
export const ExerciseChoiceUtil = ({
  account,
  exerciseContract = defaultExerciseContract,
}: ExerciseChoiceUtilProps): JSX.Element => {
  const vault = useVault()
  const [templateId, setTemplateId] = useState('')
  const [contractId, setContractId] = useState('')
  const [choice, setChoice] = useState('')
  const [json, setJson] = useState('{}')
  const [jsonValid, setJsonValid] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [updateId, setUpdateId] = useState<string | undefined>()

  const onSubmit = async (): Promise<void> => {
    const trimmedTemplateId = templateId.trim()
    const trimmedContractId = contractId.trim()
    const trimmedChoice = choice.trim()
    if (trimmedTemplateId === '') {
      setError('Template ID is required')
      return
    }
    if (trimmedContractId === '') {
      setError('Contract ID is required')
      return
    }
    if (trimmedChoice === '') {
      setError('Choice is required')
      return
    }
    setBusy(true)
    setError(undefined)
    setUpdateId(undefined)
    try {
      const choiceArgument = parseJsonObject(json, 'Choice argument')
      const result = await exerciseContract({
        account,
        templateId: trimmedTemplateId,
        contractId: trimmedContractId,
        choice: trimmedChoice,
        choiceArgument,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setUpdateId(result.updateId)
      toast.success('Choice exercised')
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
        htmlFor="exercise-template-id"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Template ID
        <TextInput
          id="exercise-template-id"
          value={templateId}
          onChange={(event) => setTemplateId(event.currentTarget.value)}
          placeholder="package:Module:TemplateOrInterface"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <label
        htmlFor="exercise-contract-id"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Contract ID
        <TextInput
          id="exercise-contract-id"
          value={contractId}
          onChange={(event) => setContractId(event.currentTarget.value)}
          placeholder="active contract id"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <label
        htmlFor="exercise-choice"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Choice
        <TextInput
          id="exercise-choice"
          value={choice}
          onChange={(event) => setChoice(event.currentTarget.value)}
          placeholder="Template_Choice"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <JsonField
        id="exercise-choice-argument-json"
        label="Choice argument JSON"
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
        {busy ? 'Exercising...' : 'Exercise choice'}
      </PrimaryButton>
    </form>
  )
}
