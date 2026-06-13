import { Stat } from '@/components/Stat'
import { quoteAmount } from '@/darkpool/darkpoolMath'
import { formatNotional, formatPrice, formatQty } from '@/darkpool/format'
import { useBook, useTrades } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

const Card = ({
  label,
  children,
  sub,
}: {
  label: string
  children: JSX.Element
  sub: string
}): JSX.Element => (
  <div className="rounded-2xl border border-border bg-surface p-4">
    <div className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-1.5">{children}</div>
    <div className="mt-1 text-xs text-soft">{sub}</div>
  </div>
)

export const VenueStats = ({ pool }: { pool: Pool }): JSX.Element => {
  const book = useBook(pool.poolId)
  const trades = useTrades(pool.poolId)
  const buys = book.filter((o) => o.side === 'Buy').length
  const sells = book.length - buys
  const notional = book.reduce((s, o) => s + quoteAmount(o.quantity, o.limitPrice), 0)
  const last = trades[0]

  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
      <Card label="Orders in book" sub={`${buys} buys · ${sells} sells`}>
        <Stat
          value={book.length}
          format={(n) => String(Math.round(n))}
          className="font-mono text-2xl text-foreground"
        />
      </Card>
      <Card label="Book notional" sub={`${pool.quoteLabel}-equivalent`}>
        <Stat
          value={notional}
          format={formatNotional}
          className="font-mono text-2xl text-foreground"
        />
      </Card>
      <Card
        label="Last match"
        sub={last ? `${formatQty(last.quantity)} ${pool.baseLabel} · midpoint` : 'no matches yet'}
      >
        {last ? (
          <Stat value={last.price} format={formatPrice} className="font-mono text-2xl text-mid" />
        ) : (
          <span className="font-mono text-2xl text-soft">—</span>
        )}
      </Card>
      <Card label="Matches settled" sub="since boot">
        <Stat
          value={trades.length}
          format={(n) => String(Math.round(n))}
          className="font-mono text-2xl text-foreground"
        />
      </Card>
    </div>
  )
}
