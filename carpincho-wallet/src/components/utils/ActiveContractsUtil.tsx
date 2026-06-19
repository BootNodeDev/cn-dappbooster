import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { SecondaryButton } from '@/components/ui/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible'
import { Copyable } from '@/components/ui/Copyable'
import { CHEVRON_DOWN_ICON } from '@/components/ui/icons'
import { JsonView } from '@/components/ui/JsonView'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { type ActiveContract, listActiveContracts as defaultList } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

interface ActiveContractsUtilProps {
  account: AccountPublic
  listActiveContracts?: typeof defaultList
}

// One active contract as a collapsible card: id first, args behind an expander.
const ContractCard = ({ contract }: { contract: ActiveContract }): JSX.Element => (
  <Collapsible className="rounded-md border border-border bg-surface">
    <div className="flex items-center gap-2 p-3">
      <CollapsibleTrigger className="group min-w-0 flex-1 text-left">
        <span className="grid size-5 shrink-0 place-items-center text-muted-foreground transition-transform group-data-[state=open]:rotate-180">
          {CHEVRON_DOWN_ICON}
        </span>
        <span className="min-w-0">
          <span className="block text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Contract ID
          </span>
          <span className="block truncate font-mono text-[0.82rem] text-foreground">
            {contract.contractId}
          </span>
        </span>
      </CollapsibleTrigger>
      <Copyable
        value={contract.contractId}
        label="contract ID"
      />
    </div>
    <CollapsibleContent className="border-t border-border px-3 pb-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[0.72rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Template
          </div>
          <div className="break-all font-mono text-[0.82rem] text-muted-foreground">
            {contract.templateId}
          </div>
        </div>
        <Copyable
          value={contract.templateId}
          label="template ID"
        />
      </div>
      {contract.createdOffset === undefined ? null : (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[0.8rem] font-medium text-muted-foreground">
            Offset {contract.createdOffset}
          </span>
          <Copyable
            value={String(contract.createdOffset)}
            label="offset"
          />
        </div>
      )}
      <JsonView
        value={contract.createArgument}
        className="mt-3"
      />
    </CollapsibleContent>
  </Collapsible>
)

// Browses the active contract set with an optional template filter.
export const ActiveContractsUtil = ({
  account,
  listActiveContracts = defaultList,
}: ActiveContractsUtilProps): JSX.Element => {
  const [filterTemplateId, setFilterTemplateId] = useState('')
  const [contracts, setContracts] = useState<ActiveContract[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [loaded, setLoaded] = useState(false)

  const refresh = useCallback(
    async (templateId: string): Promise<void> => {
      setBusy(true)
      setError(undefined)
      try {
        setContracts(
          await listActiveContracts({
            partyId: account.partyId,
            ...(templateId.trim() === '' ? {} : { templateId: templateId.trim() }),
          }),
        )
        setLoaded(true)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        toast.error(message)
      } finally {
        setBusy(false)
      }
    },
    [account.partyId, listActiveContracts],
  )

  useEffect(() => {
    void refresh('')
  }, [refresh])

  return (
    <section className="flex flex-col gap-4">
      <label
        htmlFor="filter-template-id"
        className="flex flex-col gap-2 text-[0.82rem] font-semibold uppercase tracking-wider text-muted-foreground"
      >
        Filter template ID
        <TextInput
          id="filter-template-id"
          value={filterTemplateId}
          onChange={(event) => setFilterTemplateId(event.currentTarget.value)}
          placeholder="optional"
          className="font-mono text-[0.9rem] normal-case tracking-normal"
        />
      </label>
      <SecondaryButton
        className="w-full"
        disabled={busy}
        onClick={() => {
          void refresh(filterTemplateId)
        }}
      >
        {busy ? 'Refreshing...' : 'Refresh contracts'}
      </SecondaryButton>
      {error === undefined ? null : <Alert variant="error">{error}</Alert>}
      {contracts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.9rem] font-medium text-muted-foreground">
          {loaded ? 'No active contracts.' : 'Loading active contracts...'}
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
  )
}
