import { useCallback, useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible'
import { CopyableLabel } from '@/components/ui/CopyableLabel'
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
  <Collapsible className="group rounded-md border border-border bg-surface px-3 py-2.5">
    <div className="flex items-center gap-2">
      {/* collapsed: shortened id summary; hidden when open */}
      <span className="min-w-0 flex-1 truncate font-mono text-[0.74rem] leading-5 text-foreground group-data-[state=open]:hidden">
        {shortMiddle(contract.contractId, 10, 8)}
      </span>
      {/* expanded: full contract id label + value; hidden when closed */}
      <div className="hidden min-w-0 flex-1 group-data-[state=open]:block">
        <CopyableLabel
          className="mb-1"
          label="Contract ID"
          value={contract.contractId}
          copyLabel="contract ID"
        />
        <span className="break-all font-mono text-[0.74rem] leading-5 text-foreground">
          {contract.contractId}
        </span>
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
        <CopyableLabel
          className="mb-1.5"
          label="Create arguments"
          value={JSON.stringify(contract.createArgument, null, 2)}
          copyLabel="create arguments"
        />
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
        <div className="-mx-1 flex h-[15.5rem] flex-col gap-3 overflow-y-auto px-1">
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
