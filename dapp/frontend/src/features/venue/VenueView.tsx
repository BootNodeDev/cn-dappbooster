import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { useBook, usePools } from '@/darkpool/hooks'
import type { Order } from '@/darkpool/types'
import { FullBook } from './FullBook'
import { MatchPanel } from './MatchPanel'
import { SettledMatches } from './SettledMatches'
import { VenueStats } from './VenueStats'

export const VenueView = (): JSX.Element => {
  const pools = usePools()
  const [poolId, setPoolId] = useState(pools[0]?.poolId ?? '')
  const [picked, setPicked] = useState<{ buyId: string | null; sellId: string | null }>({
    buyId: null,
    sellId: null,
  })
  const pool = pools.find((p) => p.poolId === poolId) ?? pools[0]
  const book = useBook(pool?.poolId ?? '')

  if (!pool) return <div className="py-10 text-center text-muted-foreground">Loading…</div>

  // Resolve selections against the live book so stale picks (matched/cancelled by
  // the sim) drop to null on their own.
  const buy = book.find((o) => o.orderId === picked.buyId && o.side === 'Buy') ?? null
  const sell = book.find((o) => o.orderId === picked.sellId && o.side === 'Sell') ?? null

  const onSelect = (order: Order): void => {
    setPicked((p) =>
      order.side === 'Buy' ? { ...p, buyId: order.orderId } : { ...p, sellId: order.orderId },
    )
  }
  const clearSelection = (): void => setPicked({ buyId: null, sellId: null })
  const changePool = (id: string): void => {
    setPoolId(id)
    clearSelection()
  }

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <div className="min-w-44">
          <Select
            value={pool.poolId}
            onChange={changePool}
            ariaLabel="Trading pair"
            options={pools.map((p) => ({
              value: p.poolId,
              label: `${p.baseLabel} / ${p.quoteLabel}`,
            }))}
          />
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
          Operator
        </span>
      </div>

      <VenueStats pool={pool} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr]">
        <FullBook
          pool={pool}
          selectedBuyId={picked.buyId}
          selectedSellId={picked.sellId}
          onSelect={onSelect}
        />
        <MatchPanel pool={pool} buy={buy} sell={sell} onMatched={clearSelection} />
      </div>

      <SettledMatches pool={pool} />
    </div>
  )
}
