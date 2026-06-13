import { AnimatePresence, motion } from 'framer-motion'
import { TraderFace } from '@/components/TraderFace'
import { formatPrice, formatQty } from '@/darkpool/format'
import { useBook, useTrades } from '@/darkpool/hooks'
import type { Order, Pool } from '@/darkpool/types'

const time = (ms: number): string => new Date(ms).toLocaleTimeString('en-US', { hour12: false })

const Row = ({
  order,
  selected,
  onSelect,
}: {
  order: Order
  selected: boolean
  onSelect: (o: Order) => void
}): JSX.Element => {
  const isBuy = order.side === 'Buy'
  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => onSelect(order)}
      className={`cursor-pointer border-border/60 border-b text-sm transition last:border-b-0 ${
        selected ? 'bg-primary/10' : 'hover:bg-muted'
      }`}
    >
      <td className="px-5 py-2.5">
        <span className={`font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
          {isBuy ? '▲' : '▼'}
        </span>
      </td>
      <td className={`px-5 py-2.5 font-mono ${selected ? 'text-primary' : ''}`}>
        {formatPrice(order.limitPrice)}
      </td>
      <td className="px-5 py-2.5 font-mono">{formatQty(order.quantity)}</td>
      <td className="px-5 py-2.5 font-mono text-soft">{formatQty(order.minFill)}</td>
      <td className="px-5 py-2.5">
        <span className="inline-flex items-center gap-2 font-mono text-muted-foreground">
          <span className="overflow-hidden rounded-full">
            <TraderFace name={order.trader} size={18} />
          </span>
          {order.trader.split('::')[0]}
        </span>
      </td>
      <td className="px-5 py-2.5 text-right font-mono text-soft">{time(order.submittedAt)}</td>
    </motion.tr>
  )
}

export const FullBook = ({
  pool,
  selectedBuyId,
  selectedSellId,
  onSelect,
}: {
  pool: Pool
  selectedBuyId: string | null
  selectedSellId: string | null
  onSelect: (order: Order) => void
}): JSX.Element => {
  const book = useBook(pool.poolId)
  const mid = useTrades(pool.poolId)[0]?.price ?? null
  // asks (sells) high->low on top, then the gold midpoint band, then bids (buys)
  const sells = book.filter((o) => o.side === 'Sell').sort((a, b) => b.limitPrice - a.limitPrice)
  const buys = book.filter((o) => o.side === 'Buy').sort((a, b) => b.limitPrice - a.limitPrice)
  const sel = (o: Order): boolean => o.orderId === selectedBuyId || o.orderId === selectedSellId

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-display text-base font-semibold text-foreground">
          Full book · current
        </span>
        <span className="text-xs text-soft">venue sees every resting order · click to select</span>
      </div>
      {book.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">Book is empty</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-soft">
              <th className="px-5 py-2 font-semibold">Side</th>
              <th className="px-5 py-2 font-semibold">Limit</th>
              <th className="px-5 py-2 font-semibold">Qty</th>
              <th className="px-5 py-2 font-semibold">Min fill</th>
              <th className="px-5 py-2 font-semibold">Trader</th>
              <th className="px-5 py-2 text-right font-semibold">Submitted</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {sells.map((o) => (
                <Row key={o.orderId} order={o} selected={sel(o)} onSelect={onSelect} />
              ))}
            </AnimatePresence>
            <tr>
              <td
                colSpan={6}
                className="bg-gradient-to-r from-transparent via-mid-soft to-transparent px-5 py-1.5"
              >
                <span className="flex items-center justify-center gap-2 font-mono text-[0.7rem] text-mid">
                  <span className="h-px flex-1 bg-mid/30" />
                  midpoint {mid === null ? '—' : formatPrice(mid)}
                  <span className="h-px flex-1 bg-mid/30" />
                </span>
              </td>
            </tr>
            <AnimatePresence initial={false}>
              {buys.map((o) => (
                <Row key={o.orderId} order={o} selected={sel(o)} onSelect={onSelect} />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </section>
  )
}
