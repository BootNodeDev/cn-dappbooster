import { Fragment, useState } from 'react'
import { CHEVRON_RIGHT_ICON, RECEIPT_ICON } from '@/components/ui/icons'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/utils/cn'
import { prettyJson } from '@/utils/json'
import type { TransactionRecord } from '@/vault/types'
import { CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT } from '@/wc/client'

const DATE_GROUP_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const TIME_FMT = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
})

// Show the public wallet API name users recognize.
const txMethodLabel = (method: string): string =>
  method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT ? 'executeAndWait' : method

// Human summary when present, otherwise the wallet API method.
const txTitle = (tx: TransactionRecord): string => tx.summary ?? txMethodLabel(tx.method)

interface TxDetailRow {
  label: string
  value: string | number
  mono?: boolean
}

// Scalar metadata rows shown before the command payload block.
const txDetailRows = (tx: TransactionRecord): TxDetailRow[] => {
  const rows: TxDetailRow[] = [
    { label: 'Summary', value: tx.summary ?? 'Canton transaction' },
    { label: 'Account', value: tx.accountName },
    {
      label: 'Time',
      value: `${DATE_GROUP_FMT.format(tx.createdAt)}, ${TIME_FMT.format(tx.createdAt)}`,
    },
  ]
  if (tx.commandCount !== undefined) {
    rows.push({ label: 'Commands', value: tx.commandCount })
  }
  rows.push(
    { label: 'Network', value: tx.network },
    { label: 'Party', value: tx.partyId, mono: true },
    { label: 'Method', value: txMethodLabel(tx.method) },
    { label: 'Prepared hash', value: tx.preparedTransactionHash, mono: true },
  )
  if (tx.commandId !== undefined) {
    rows.push({ label: 'Command ID', value: tx.commandId, mono: true })
  }
  if (tx.submissionId !== undefined) {
    rows.push({ label: 'Submission ID', value: tx.submissionId, mono: true })
  }
  if (tx.updateId !== undefined) {
    rows.push({ label: 'Update ID', value: tx.updateId, mono: true })
  }
  if (tx.completionOffset !== undefined) {
    rows.push({ label: 'Completion offset', value: tx.completionOffset })
  }
  return rows
}

// Whether the transaction has original dApp commands worth showing as audit JSON.
const hasCommandPayload = (tx: TransactionRecord): boolean =>
  tx.commands !== undefined && tx.commands.length > 0

interface DateGroup {
  label: string
  items: TransactionRecord[]
}

// Newest-first, bucketed under per-day headers.
const groupByDate = (transactions: TransactionRecord[]): DateGroup[] => {
  const groups: DateGroup[] = []
  for (const tx of [...transactions].sort((a, b) => b.createdAt - a.createdAt)) {
    const label = DATE_GROUP_FMT.format(tx.createdAt)
    const last = groups[groups.length - 1]
    if (last !== undefined && last.label === label) {
      last.items.push(tx)
    } else {
      groups.push({ label, items: [tx] })
    }
  }
  return groups
}

// Detail body shown inside the popup opened from an activity row.
const TransactionDetails = ({ tx }: { tx: TransactionRecord }): JSX.Element => (
  <div>
    <dl className="m-0 grid grid-cols-[minmax(96px,auto)_1fr] gap-x-3 gap-y-2 text-[0.92rem]">
      {txDetailRows(tx).map((row) => (
        <Fragment key={row.label}>
          <dt className="font-semibold tracking-tight text-muted-foreground">{row.label}</dt>
          <dd
            className={cn(
              'm-0 min-w-0 font-medium text-soft [overflow-wrap:anywhere]',
              row.mono && 'font-mono text-[0.88rem]',
            )}
          >
            {row.value}
          </dd>
        </Fragment>
      ))}
    </dl>
    {hasCommandPayload(tx) && (
      <div className="mt-3">
        <div className="mb-1.5 text-[0.92rem] font-semibold tracking-tight text-muted-foreground">
          Command payload
        </div>
        <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-[0.78rem] leading-relaxed text-soft">
          {prettyJson(tx.commands)}
        </pre>
      </div>
    )}
  </div>
)

interface ActivityListProps {
  transactions: TransactionRecord[]
}

// Executed transactions grouped by day; a row opens a detail popup.
export const ActivityList = ({ transactions }: ActivityListProps): JSX.Element => {
  const [selected, setSelected] = useState<TransactionRecord | null>(null)

  if (transactions.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col pb-2">
      {groupByDate(transactions).map((group) => (
        <div key={group.label}>
          <div className="px-1 pb-1 pt-3 text-[0.8rem] font-semibold tracking-tight text-muted-foreground">
            {group.label}
          </div>
          {group.items.map((tx) => (
            <button
              key={tx.id}
              type="button"
              onClick={() => setSelected(tx)}
              className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-2.5 text-left outline-none transition-colors hover:bg-primary-soft/40 focus-visible:bg-primary-soft/60"
            >
              <span
                aria-hidden="true"
                className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
              >
                {RECEIPT_ICON}
              </span>
              <span className="min-w-0">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-[0.94rem] font-semibold text-foreground">
                    {txTitle(tx)}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[0.72rem] font-normal italic text-muted-foreground">
                    {TIME_FMT.format(tx.createdAt)}
                  </span>
                </span>
                <span className="block text-[0.84rem] font-medium text-success">Confirmed</span>
              </span>
              <span
                aria-hidden="true"
                className="justify-self-end text-muted-foreground"
              >
                {CHEVRON_RIGHT_ICON}
              </span>
            </button>
          ))}
        </div>
      ))}

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null)
        }}
        side="center"
        title={selected === null ? '' : txTitle(selected)}
        description="Transaction details."
      >
        {selected !== null && <TransactionDetails tx={selected} />}
      </Sheet>
    </div>
  )
}
