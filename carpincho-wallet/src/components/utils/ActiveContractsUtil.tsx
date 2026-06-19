import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible'
import { Copyable } from '@/components/ui/Copyable'
import { DetailRow } from '@/components/ui/DetailRow'
import { CHEVRON_DOWN_ICON } from '@/components/ui/icons'
import { JsonView } from '@/components/ui/JsonView'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { type ActiveContract, listActiveContracts as defaultList } from '@/ledger/contracts'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'

interface ActiveContractsUtilProps {
  account: AccountPublic
  listActiveContracts?: typeof defaultList
}

// One active contract as a collapsible card: id + chevron, args behind an expander.
const ContractCard = ({ contract }: { contract: ActiveContract }): JSX.Element => (
  <Collapsible className="group rounded-md border border-border bg-surface p-3">
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-1.5">
          <span className="text-[0.7rem] font-semibold uppercase text-muted-foreground">
            Contract ID
          </span>
          <Copyable
            value={contract.contractId}
            label="contract ID"
          />
        </div>
        <div className="break-all rounded-md border border-border bg-muted px-3 py-2 font-mono text-[0.74rem] leading-5 text-foreground">
          <span className="block truncate group-data-[state=open]:hidden">
            {shortMiddle(contract.contractId, 10, 8)}
          </span>
          <span className="hidden group-data-[state=open]:block">{contract.contractId}</span>
        </div>
      </div>
      <CollapsibleTrigger className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:shadow-focus [&_svg]:size-5">
        <span className="sr-only">Toggle contract details</span>
        <span className="transition-transform group-data-[state=open]:rotate-180">
          {CHEVRON_DOWN_ICON}
        </span>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      <DetailRow
        label="Template"
        value={contract.templateId}
        copyLabel="template ID"
      />
      {contract.createdOffset === undefined ? null : (
        <DetailRow
          label="Offset"
          value={String(contract.createdOffset)}
          copyLabel="offset"
        />
      )}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-[0.7rem] font-semibold uppercase text-muted-foreground">
            Create arguments
          </span>
          <Copyable
            value={JSON.stringify(contract.createArgument, null, 2)}
            label="create arguments"
          />
        </div>
        <JsonView value={contract.createArgument} />
      </div>
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
      <PrimaryButton
        className="w-full"
        disabled={busy}
        onClick={() => {
          void refresh(filterTemplateId)
        }}
      >
        {busy ? 'Refreshing...' : 'Refresh contracts'}
      </PrimaryButton>
      {error === undefined ? null : <Alert variant="error">{error}</Alert>}
      {contracts.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-[0.9rem] font-medium text-muted-foreground">
          {loaded ? 'No active contracts.' : 'Loading active contracts...'}
        </p>
      ) : (
        <div className="-mx-1 flex max-h-[22rem] flex-col gap-3 overflow-y-auto px-1">
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
