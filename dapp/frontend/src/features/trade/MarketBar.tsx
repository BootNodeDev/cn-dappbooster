import { Select } from '@/components/ui/Select'
import { formatQty } from '@/darkpool/format'
import { useTrades } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

export const MarketBar = ({
  pool,
  pools,
  onPoolChange,
}: {
  pool: Pool
  pools: Pool[]
  onPoolChange: (poolId: string) => void
}): JSX.Element => {
  const trades = useTrades(pool.poolId)
  const fills = trades.length
  const volume = trades.reduce((s, t) => s + t.quantity, 0)

  return (
    <section className="flex flex-wrap items-center gap-x-8 gap-y-3 border-border border-b pb-4">
      <div className="min-w-44">
        <Select
          value={pool.poolId}
          onChange={onPoolChange}
          ariaLabel="Trading pair"
          options={pools.map((p) => ({
            value: p.poolId,
            label: `${p.baseLabel} / ${p.quoteLabel}`,
          }))}
        />
      </div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Recent fills
        </span>
        <span className="font-mono text-foreground">
          {fills} · {formatQty(volume)} {pool.baseLabel}
        </span>
      </div>
      <div className="flex items-baseline gap-2 text-sm">
        <span className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
          Pool floor
        </span>
        <span className="font-mono text-foreground">
          {formatQty(pool.minFillFloor)} {pool.baseLabel}
        </span>
      </div>
    </section>
  )
}
