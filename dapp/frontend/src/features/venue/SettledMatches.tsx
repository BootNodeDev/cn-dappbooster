import { AnimatePresence, motion } from 'framer-motion'
import { TraderChip } from '@/components/TraderChip'
import { formatPrice, formatQty, formatTime } from '@/darkpool/format'
import { useTrades } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

export const SettledMatches = ({ pool }: { pool: Pool }): JSX.Element => {
  const trades = useTrades(pool.poolId)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="font-display text-base font-semibold text-foreground">
          Settled matches
        </span>
        <span className="text-xs text-soft">every match this venue cleared</span>
      </div>
      {trades.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          No matches settled yet
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-soft">
              <th scope="col" className="px-5 py-2 font-semibold">
                Price
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Qty
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Buyer
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Seller
              </th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">
                Settled
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {trades.map((t) => (
                <motion.tr
                  key={t.tradeId}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="border-b border-border/60 text-sm last:border-b-0"
                >
                  <td className="px-5 py-2.5 font-mono text-mid">{formatPrice(t.price)}</td>
                  <td className="px-5 py-2.5 font-mono">{formatQty(t.quantity)}</td>
                  <td className="px-5 py-2.5">
                    <TraderChip name={t.buyer} />
                  </td>
                  <td className="px-5 py-2.5">
                    <TraderChip name={t.seller} />
                  </td>
                  <td className="px-5 py-2.5 text-right font-mono text-soft">
                    {formatTime(t.settledAt)}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </section>
  )
}
