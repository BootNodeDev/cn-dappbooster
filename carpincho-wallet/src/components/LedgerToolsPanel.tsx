import { useState } from 'react'
import { DarUploadPanel } from '@/components/DarUploadPanel'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import { INPUT_CLASS, TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import {
  type ActiveContract,
  createContract,
  exerciseContract,
  listActiveContracts,
} from '@/ledger/contracts'
import { cn } from '@/utils/cn'
import { formatJsonInput, parseJsonObject, prettyJson } from '@/utils/json'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface LedgerToolsApi {
  createContract: typeof createContract
  exerciseContract: typeof exerciseContract
  listActiveContracts: typeof listActiveContracts
}

interface LedgerToolsPanelProps {
  account?: AccountPublic
  api?: LedgerToolsApi
}

const defaultApi: LedgerToolsApi = { createContract, exerciseContract, listActiveContracts }

const EMPTY_JSON = '{}'

// Formats a ledger JSON textarea when possible without interrupting partially typed input.
const formatJsonTextarea = (
  value: string,
  setValue: (value: string) => void,
  label: string,
): void => {
  try {
    setValue(formatJsonInput(value, label))
  } catch {
    return
  }
}

// Renders one active contract with the id first for copying/inspection.
const ContractCard = ({ contract }: { contract: ActiveContract }): JSX.Element => (
  <article className="rounded-md border border-border bg-surface p-3">
    <div className="flex flex-col gap-1">
      <span className="text-[0.72rem] font-semibold uppercase text-muted-foreground">
        Contract ID
      </span>
      <span className="break-all font-mono text-[0.82rem] text-foreground">
        {contract.contractId}
      </span>
    </div>
    <div className="mt-3 grid gap-1">
      <span className="text-[0.72rem] font-semibold uppercase text-muted-foreground">Template</span>
      <span className="break-all font-mono text-[0.82rem] text-muted-foreground">
        {contract.templateId}
      </span>
    </div>
    {contract.createdOffset === undefined ? null : (
      <p className="mt-3 text-[0.8rem] font-medium text-muted-foreground">
        Offset {contract.createdOffset}
      </p>
    )}
    <pre className="mt-3 max-h-48 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-[0.78rem] leading-relaxed text-foreground">
      {prettyJson(contract.createArgument)}
    </pre>
  </article>
)

// Development ledger utility for generic creates and active-contract inspection.
export const LedgerToolsPanel = ({
  account,
  api = defaultApi,
}: LedgerToolsPanelProps): JSX.Element => {
  const vault = useVault()
  const [createTemplateId, setCreateTemplateId] = useState('')
  const [createJson, setCreateJson] = useState(EMPTY_JSON)
  const [exerciseTemplateId, setExerciseTemplateId] = useState('')
  const [exerciseContractId, setExerciseContractId] = useState('')
  const [exerciseChoice, setExerciseChoice] = useState('')
  const [exerciseJson, setExerciseJson] = useState(EMPTY_JSON)
  const [filterTemplateId, setFilterTemplateId] = useState('')
  const [contracts, setContracts] = useState<ActiveContract[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [createdUpdateId, setCreatedUpdateId] = useState<string | undefined>()
  const [exercisedUpdateId, setExercisedUpdateId] = useState<string | undefined>()

  // Reloads ACS for the active party and preserves any optional template filter.
  const refreshContracts = async (templateId = filterTemplateId): Promise<void> => {
    if (account === undefined) {
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      setContracts(
        await api.listActiveContracts({
          partyId: account.partyId,
          ...(templateId.trim() === '' ? {} : { templateId: templateId.trim() }),
        }),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  // Submits one generic CreateCommand and refreshes ACS so created CIDs are visible.
  const onCreate = async (): Promise<void> => {
    if (account === undefined) {
      return
    }
    const templateId = createTemplateId.trim()
    if (templateId === '') {
      setError('Template ID is required')
      return
    }
    setBusy(true)
    setError(undefined)
    setCreatedUpdateId(undefined)
    try {
      const createArguments = parseJsonObject(createJson, 'Create arguments')
      setCreateJson(prettyJson(createArguments))
      const result = await api.createContract({
        account,
        templateId,
        createArguments,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setCreatedUpdateId(result.updateId)
      toast.success('Contract created')
      await refreshContracts(templateId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  // Submits one generic ExerciseCommand and refreshes ACS because the choice may archive/create.
  const onExercise = async (): Promise<void> => {
    if (account === undefined) {
      return
    }
    const templateId = exerciseTemplateId.trim()
    const contractId = exerciseContractId.trim()
    const choice = exerciseChoice.trim()
    if (templateId === '') {
      setError('Exercise template ID is required')
      return
    }
    if (contractId === '') {
      setError('Contract ID is required')
      return
    }
    if (choice === '') {
      setError('Choice is required')
      return
    }
    setBusy(true)
    setError(undefined)
    setExercisedUpdateId(undefined)
    try {
      const choiceArgument = parseJsonObject(exerciseJson, 'Choice argument')
      setExerciseJson(prettyJson(choiceArgument))
      const result = await api.exerciseContract({
        account,
        templateId,
        contractId,
        choice,
        choiceArgument,
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setExercisedUpdateId(result.updateId)
      toast.success('Choice exercised')
      await refreshContracts()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      toast.error(message)
    } finally {
      setBusy(false)
    }
  }

  if (account === undefined) {
    return (
      <section className="px-1 py-2">
        <Alert variant="warning">Create an account before using ledger tools.</Alert>
      </section>
    )
  }

  return (
    <Tabs
      defaultValue="create"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList className="gap-4">
        <TabTrigger value="create">Create</TabTrigger>
        <TabTrigger value="exercise">Exercise</TabTrigger>
        <TabTrigger value="contracts">Contracts</TabTrigger>
        <TabTrigger value="dar">DAR</TabTrigger>
      </TabsList>
      <TabContent
        value="create"
        className="min-h-0 overflow-y-auto px-1 py-3"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate()
          }}
        >
          <label
            htmlFor="ledger-create-template-id"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Template ID
            <TextInput
              id="ledger-create-template-id"
              value={createTemplateId}
              onChange={(event) => setCreateTemplateId(event.currentTarget.value)}
              placeholder="package:Module:Template"
              className="font-mono text-[0.9rem] normal-case"
            />
          </label>
          <label
            htmlFor="ledger-create-arguments-json"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Create arguments JSON
            <textarea
              id="ledger-create-arguments-json"
              value={createJson}
              onChange={(event) => setCreateJson(event.currentTarget.value)}
              onBlur={() => formatJsonTextarea(createJson, setCreateJson, 'Create arguments')}
              spellCheck={false}
              className={cn(INPUT_CLASS, 'min-h-44 resize-y font-mono text-[0.85rem] normal-case')}
            />
          </label>
          {error === undefined ? null : <Alert variant="error">{error}</Alert>}
          {createdUpdateId === undefined ? null : (
            <Alert variant="success">Created update {createdUpdateId}</Alert>
          )}
          <PrimaryButton
            type="submit"
            className="w-full"
            disabled={busy}
          >
            {busy ? 'Creating...' : 'Create contract'}
          </PrimaryButton>
        </form>
      </TabContent>
      <TabContent
        value="exercise"
        className="min-h-0 overflow-y-auto px-1 py-3"
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void onExercise()
          }}
        >
          <label
            htmlFor="ledger-exercise-template-id"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Exercise template ID
            <TextInput
              id="ledger-exercise-template-id"
              value={exerciseTemplateId}
              onChange={(event) => setExerciseTemplateId(event.currentTarget.value)}
              placeholder="package:Module:TemplateOrInterface"
              className="font-mono text-[0.9rem] normal-case"
            />
          </label>
          <label
            htmlFor="ledger-exercise-contract-id"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Contract ID
            <TextInput
              id="ledger-exercise-contract-id"
              value={exerciseContractId}
              onChange={(event) => setExerciseContractId(event.currentTarget.value)}
              placeholder="active contract id"
              className="font-mono text-[0.9rem] normal-case"
            />
          </label>
          <label
            htmlFor="ledger-exercise-choice"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Choice
            <TextInput
              id="ledger-exercise-choice"
              value={exerciseChoice}
              onChange={(event) => setExerciseChoice(event.currentTarget.value)}
              placeholder="Template_Choice"
              className="font-mono text-[0.9rem] normal-case"
            />
          </label>
          <label
            htmlFor="ledger-exercise-choice-json"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Choice argument JSON
            <textarea
              id="ledger-exercise-choice-json"
              value={exerciseJson}
              onChange={(event) => setExerciseJson(event.currentTarget.value)}
              onBlur={() => formatJsonTextarea(exerciseJson, setExerciseJson, 'Choice argument')}
              spellCheck={false}
              className={cn(INPUT_CLASS, 'min-h-44 resize-y font-mono text-[0.85rem] normal-case')}
            />
          </label>
          {error === undefined ? null : <Alert variant="error">{error}</Alert>}
          {exercisedUpdateId === undefined ? null : (
            <Alert variant="success">Exercised update {exercisedUpdateId}</Alert>
          )}
          <PrimaryButton
            type="submit"
            className="w-full"
            disabled={busy}
          >
            {busy ? 'Exercising...' : 'Exercise choice'}
          </PrimaryButton>
        </form>
      </TabContent>
      <TabContent
        value="contracts"
        className="min-h-0 overflow-y-auto px-1 py-3"
      >
        <section className="flex flex-col gap-4">
          <label
            htmlFor="ledger-filter-template-id"
            className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase text-muted-foreground"
          >
            Filter template ID
            <TextInput
              id="ledger-filter-template-id"
              value={filterTemplateId}
              onChange={(event) => setFilterTemplateId(event.currentTarget.value)}
              placeholder="optional"
              className="font-mono text-[0.9rem] normal-case"
            />
          </label>
          <SecondaryButton
            className="w-full"
            disabled={busy}
            onClick={() => {
              void refreshContracts()
            }}
          >
            {busy ? 'Refreshing...' : 'Refresh contracts'}
          </SecondaryButton>
          {error === undefined ? null : <Alert variant="error">{error}</Alert>}
          {contracts.length === 0 ? (
            <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.9rem] font-medium text-muted-foreground">
              No active contracts loaded.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {contracts.map((contract) => (
                <ContractCard
                  key={contract.contractId}
                  contract={contract}
                />
              ))}
            </div>
          )}
        </section>
      </TabContent>
      <TabContent
        value="dar"
        className="min-h-0 overflow-y-auto px-1 py-3"
      >
        <DarUploadPanel />
      </TabContent>
    </Tabs>
  )
}
