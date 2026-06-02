import { Fragment } from 'react'
import { CARD_CLASS } from '@/components/ui/Card.tsx'
import { SectionTitle } from '@/components/ui/SectionTitle.tsx'
import { shortMiddle } from '@/utils/account.ts'
import { cn } from '@/utils/cn.ts'
import { prettyJson } from '@/utils/json.ts'
import type { TransactionRecord } from '@/vault/types.ts'
import { CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT } from '@/wc/client.ts'

const TX_TIME_FMT = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const txTime = (tx: TransactionRecord): string => TX_TIME_FMT.format(tx.createdAt)

// Keeps the Activity row label aligned with the public wallet API name users recognize.
const txMethodLabel = (method: string): string =>
  method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT ? 'executeAndWait' : method

interface TxDetailRow {
  label: string
  value: string | number
  mono?: boolean
}

// Builds the scalar metadata rows shown before the larger command payload block.
const txDetailRows = (tx: TransactionRecord): TxDetailRow[] => {
  const rows: TxDetailRow[] = [
    { label: 'Summary', value: tx.summary ?? 'Canton transaction' },
    { label: 'Account', value: tx.accountName },
    { label: 'Time', value: txTime(tx) },
  ]
  if (tx.commandCount !== undefined) {
    rows.push({ label: 'Commands', value: tx.commandCount })
  }
  rows.push(
    { label: 'Network', value: tx.network },
    { label: 'Party', value: tx.partyId, mono: true },
    { label: 'Method', value: tx.method },
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

// Checks whether the transaction has original dApp commands worth showing as audit JSON.
const hasCommandPayload = (tx: TransactionRecord): boolean =>
  tx.commands !== undefined && tx.commands.length > 0

interface ActivityListProps {
  transactions: TransactionRecord[]
}

// Renders recent executed transactions with expandable details for hashes and command payloads.
export const ActivityList = ({ transactions }: ActivityListProps): JSX.Element => {
  const visibleTxs = transactions.slice(0, 8)

  return (
    <section className={cn(CARD_CLASS, 'p-3.5')}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <SectionTitle>Activity</SectionTitle>
        <span className="font-mono text-[0.78rem] font-semibold text-muted-foreground tracking-tight">
          {transactions.length === 0
            ? 'empty'
            : `${transactions.length} record${transactions.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {visibleTxs.length === 0 ? (
        <div className="px-2 py-7 text-center text-muted-foreground">
          <div className="font-display text-[1.3rem] font-semibold text-foreground tracking-tight">
            Nothing yet
          </div>
          <p className="text-[0.95rem] font-medium mt-1 mb-0">
            Executed transactions will surface here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col">
          {visibleTxs.map((tx, idx) => (
            <details
              key={tx.id}
              className={cn('group transition-colors', idx > 0 && 'border-t border-border/60')}
            >
              <summary className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] items-center gap-3 min-h-12 cursor-pointer list-none px-1 py-2.5 [&::-webkit-details-marker]:hidden hover:bg-primary-soft/40 -mx-1 rounded-sm">
                <span
                  className="min-w-0 truncate text-[0.92rem] font-medium text-foreground font-mono"
                  title={tx.preparedTransactionHash}
                >
                  {shortMiddle(tx.preparedTransactionHash, 9, 7)}
                </span>
                <span
                  className="min-w-0 truncate text-soft text-[0.9rem] font-medium"
                  title={tx.method}
                >
                  {txMethodLabel(tx.method)}
                </span>
                <span className="justify-self-end font-mono text-[0.72rem] font-semibold uppercase tracking-eyebrow text-primary group-open:text-muted-foreground transition-colors whitespace-nowrap">
                  <span className="group-open:hidden">open</span>
                  <span className="hidden group-open:inline">close</span>
                </span>
              </summary>
              <div className="pt-2 pb-3 px-1">
                <dl className="grid grid-cols-[minmax(96px,auto)_1fr] gap-x-3 gap-y-2 m-0 text-[0.92rem]">
                  {txDetailRows(tx).map((row) => (
                    <Fragment key={row.label}>
                      <dt className="text-muted-foreground font-semibold tracking-tight">
                        {row.label}
                      </dt>
                      <dd
                        className={cn(
                          'm-0 min-w-0 [overflow-wrap:anywhere] text-soft font-medium',
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
                    <div className="mb-1.5 text-muted-foreground font-semibold tracking-tight text-[0.92rem]">
                      Command payload
                    </div>
                    <pre className="max-h-48 overflow-auto rounded-md border border-border bg-background/60 p-3 m-0 whitespace-pre-wrap break-words font-mono text-[0.78rem] leading-relaxed text-soft">
                      {prettyJson(tx.commands)}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  )
}
