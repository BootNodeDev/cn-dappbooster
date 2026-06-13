import { AnimatePresence, motion } from 'framer-motion'
import { formatPrice, formatQty } from '@/darkpool/format'
import { useBook } from '@/darkpool/hooks'
import type { Order, Pool } from '@/darkpool/types'

const time = (ms: number): string => new Date(ms).toLocaleTimeString('en-US', { hour12: false })

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
  // sells high->low on top, buys high->low below, so the crossing midpoint sits together
  const book = useBook(pool.poolId)
  const sells = book.filter((o) => o.side === 'Sell').sort((a, b) => b.limitPrice - a.limitPrice)
  const buys = book.filter((o) => o.side === 'Buy').sort((a, b) => b.limitPrice - a.limitPrice)
  const ordered = [...sells, ...buys]

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-display text-base font-semibold text-foreground">
          Full book · current
        </span>
        <span className="text-xs text-soft">venue sees every resting order · click to select</span>
      </div>
      {ordered.length === 0 ? (
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
              {ordered.map((o) => {
                const isBuy = o.side === 'Buy'
                const selected = o.orderId === selectedBuyId || o.orderId === selectedSellId
                return (
                  <motion.tr
                    key={o.orderId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => onSelect(o)}
                    className={`cursor-pointer border-b border-border/60 text-sm transition last:border-b-0 ${
                      selected ? 'bg-primary/10' : 'hover:bg-muted'
                    }`}
                  >
                    <td className="px-5 py-2.5">
                      <span className={`font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
                        {isBuy ? '▲' : '▼'}
                      </span>
                    </td>
                    <td className={`px-5 py-2.5 font-mono ${selected ? 'text-primary' : ''}`}>
                      {formatPrice(o.limitPrice)}
                    </td>
                    <td className="px-5 py-2.5 font-mono">{formatQty(o.quantity)}</td>
                    <td className="px-5 py-2.5 font-mono text-soft">{formatQty(o.minFill)}</td>
                    <td className="px-5 py-2.5 font-mono text-muted-foreground">
                      {o.trader.split('::')[0]}
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-soft">
                      {time(o.submittedAt)}
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </section>
  )
}
