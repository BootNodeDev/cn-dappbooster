import { useState } from 'react'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { transferTimeLabel } from '@/cip56/transfers'
import { SecondaryButton } from '@/components/ui/Button'
import { useTokenHoldingDetails } from '@/hooks/useTokenHoldingDetails'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface AssetsPanelProps {
  account?: AccountPublic
  api?: Cip56HoldingsApi
}

interface HoldingDetailRowProps {
  label: string
  value: string
}

interface TokenHoldingDetailsProps {
  account: AccountPublic
  api?: Cip56HoldingsApi
  summary: TokenHoldingSummary
}

// Keeps raw holding values readable in the expanded UTXO details area.
const HoldingDetailRow = ({ label, value }: HoldingDetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)

// Fetches UTXO details lazily so Scan summaries can render balances quickly.
const TokenHoldingDetails = ({ account, api, summary }: TokenHoldingDetailsProps): JSX.Element => {
  const detailsApi =
    api?.listTokenHoldings === undefined ? undefined : { listTokenHoldings: api.listTokenHoldings }
  const { holdings, loading, error } = useTokenHoldingDetails(account, summary, {
    api: detailsApi,
    enabled: true,
  })

  if (loading && holdings.length === 0) {
    return <p className="m-0 text-[0.82rem] text-muted-foreground">Loading UTXOs</p>
  }

  if (error !== undefined) {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
        {error}
      </div>
    )
  }

  if (holdings.length === 0) {
    return <p className="m-0 text-[0.82rem] text-muted-foreground">No UTXO details</p>
  }

  return (
    <>
      {holdings.map((holding) => {
        const view = holding.interfaceViewValue
        const lock = view?.lock
        return (
          <dl
            key={holding.contractId}
            className="grid gap-3 rounded-md border border-border bg-surface px-3 py-3"
          >
            <HoldingDetailRow
              label="amount"
              value={view?.amount ?? 'unknown'}
            />
            <HoldingDetailRow
              label="lock"
              value={lock == null ? 'unlocked' : 'locked'}
            />
            {lock?.expiresAt === undefined ? null : (
              <HoldingDetailRow
                label="expires"
                value={transferTimeLabel(lock.expiresAt)}
              />
            )}
            <HoldingDetailRow
              label="contract id"
              value={holding.contractId}
            />
          </dl>
        )
      })}
    </>
  )
}

// Renders active CIP-56 token holding UTXOs grouped as token balances.
export const AssetsPanel = ({ account, api }: AssetsPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [expandedTokenKey, setExpandedTokenKey] = useState<string | undefined>(undefined)
  const { summaries, loading, error } = useTokenHoldings(activeAccount, { api })

  // Keeps only one token's UTXO list open so the compact wallet panel stays scannable.
  const toggleHoldings = (key: string): void => {
    setExpandedTokenKey((current) => (current === key ? undefined : key))
  }

  if (activeAccount === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No account selected</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col gap-3 px-1 py-2">
      {error === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      )}

      {summaries.length === 0 && !loading ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No token holdings</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {summaries.map((summary) => {
            const isExpanded = expandedTokenKey === summary.key
            const detailsId = `token-holdings-${summary.key}`
            return (
              <article
                key={summary.key}
                className="rounded-md border border-border bg-surface px-3 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.95rem] font-semibold text-foreground">
                      {summary.totalAmount} {summary.tokenLabel}
                    </p>
                    <p className="m-0 mt-1 flex flex-wrap gap-x-1 text-[0.78rem] text-muted-foreground">
                      {summary.utxoCount === undefined ? (
                        <span>UTXOs load on demand</span>
                      ) : (
                        <span>
                          {summary.utxoCount} {summary.utxoCount === 1 ? 'UTXO' : 'UTXOs'}
                        </span>
                      )}
                      {(summary.lockedCount ?? 0) > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{summary.lockedCount} locked</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <SecondaryButton
                    aria-controls={detailsId}
                    aria-expanded={isExpanded}
                    className="shrink-0 px-3 py-1.5 text-[0.78rem]"
                    onClick={() => toggleHoldings(summary.key)}
                  >
                    {isExpanded ? 'Hide holdings' : 'Show holdings'}
                  </SecondaryButton>
                </div>
                {isExpanded ? (
                  <div
                    id={detailsId}
                    className="mt-3 flex flex-col gap-3 rounded-md border border-border bg-background/60 p-3"
                  >
                    <TokenHoldingDetails
                      account={activeAccount}
                      api={api}
                      summary={summary}
                    />
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {loading ? (
        <span className="px-1 text-[0.78rem] text-muted-foreground">Refreshing</span>
      ) : null}
    </div>
  )
}
