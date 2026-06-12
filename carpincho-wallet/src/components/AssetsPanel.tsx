import { useState } from 'react'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import type { Cip56SendApi } from '@/components/SendTokenForm'
import { TokenDetailSheet } from '@/components/TokenDetailSheet'
import { TokenRow } from '@/components/TokenRow'
import { LoadingState } from '@/components/ui/LoadingState'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export interface AssetsPanelProps {
  account?: AccountPublic
  api?: Cip56HoldingsApi
  sendApi?: Cip56SendApi
}

// Renders active CIP-56 token holdings as activity-style rows that open a detail modal.
export const AssetsPanel = ({ account, api, sendApi }: AssetsPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const [selected, setSelected] = useState<TokenHoldingSummary | null>(null)
  const { summaries, loading, error, refresh } = useTokenHoldings(activeAccount, { api })

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

      {summaries.length > 0 ? (
        <div className="flex flex-col">
          {summaries.map((summary) => (
            <TokenRow
              key={summary.key}
              summary={summary}
              onOpen={() => setSelected(summary)}
            />
          ))}
        </div>
      ) : loading ? (
        <LoadingState label="Loading assets" />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 text-center">
          <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No token holdings</p>
        </div>
      )}

      {selected !== null && (
        <TokenDetailSheet
          open={selected !== null}
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
          account={activeAccount}
          summary={selected}
          holdingsApi={api}
          sendApi={sendApi}
          onSent={() => {
            void refresh()
          }}
        />
      )}
    </div>
  )
}
