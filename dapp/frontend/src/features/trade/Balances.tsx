import { Stat } from '@/components/Stat'
import { formatNotional, formatQty } from '@/darkpool/format'
import { useBalances } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

export const Balances = ({ pool, party }: { pool: Pool; party: string }): JSX.Element => {
  const balances = useBalances(party)
  const base = balances.find((b) => b.label === pool.baseLabel)
  const quote = balances.find((b) => b.label === pool.quoteLabel)

  const row = (
    label: string,
    total: number,
    declared: number,
    fmt: (n: number) => string,
  ): JSX.Element => (
    <div className="flex items-end justify-between">
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs text-soft">{fmt(declared)} declared</div>
      </div>
      <Stat value={total} format={fmt} className="font-mono text-lg text-foreground" />
    </div>
  )

  return (
    <section className="flex grow flex-col rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
        Balances
      </div>
      <div className="flex grow flex-col justify-center gap-3">
        {row(pool.baseLabel, base?.total ?? 0, base?.declared ?? 0, formatQty)}
        <div className="h-px bg-border" />
        {row(pool.quoteLabel, quote?.total ?? 0, quote?.declared ?? 0, formatNotional)}
      </div>
    </section>
  )
}
