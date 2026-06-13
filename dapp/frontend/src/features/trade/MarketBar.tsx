import { Stat } from '@/components/Stat'
import { Select } from '@/components/ui/Select'
import { formatPrice, formatQty } from '@/darkpool/format'
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
  const mid = trades[0]?.price ?? null
  const dayFills = trades.length
  const dayVolume = trades.reduce((s, t) => s + t.quantity, 0)

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-7">
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
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Mid price
          </div>
          {mid === null ? (
            <div className="font-mono text-xl text-soft">—</div>
          ) : (
            <Stat value={mid} format={formatPrice} className="font-mono text-xl text-primary" />
          )}
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Recent fills
          </div>
          <div className="mt-1 font-mono text-sm">
            {dayFills} · {formatQty(dayVolume)} {pool.baseLabel}
          </div>
        </div>
        <div>
          <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">
            Pool floor
          </div>
          <div className="mt-1 font-mono text-sm">
            {formatQty(pool.minFillFloor)} {pool.baseLabel}
          </div>
        </div>
      </div>
      <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
        <span className="size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
        Shielded book · live
      </span>
    </section>
  )
}
