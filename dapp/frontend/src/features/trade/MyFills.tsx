import { AnimatePresence, motion } from 'framer-motion'
import { SideTag } from '@/components/SideTag'
import { TraderChip } from '@/components/TraderChip'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatNotional, formatPrice, formatQty, formatTime } from '@/darkpool/format'
import { useMyFills } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

export const MyFills = ({ pool, party }: { pool: Pool; party: string }): JSX.Element => {
  const fills = useMyFills(party).filter((f) => f.poolId === pool.poolId)

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="font-display text-base font-semibold text-foreground">My fills</span>
        <Tooltip
          label="Who can see your fills"
          content="Visible only to you, your counterparty and the venue."
        />
      </div>
      {fills.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No fills yet</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-soft">
              <th scope="col" className="px-5 py-2 font-semibold">
                Side
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Clearing price
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Quantity
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Notional
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Counterparty
              </th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">
                Settled
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {fills.map((f) => {
                return (
                  <motion.tr
                    key={f.fillId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-border/60 text-sm last:border-b-0"
                  >
                    <td className="px-5 py-2.5">
                      <SideTag side={f.side} />
                    </td>
                    <td className="px-5 py-2.5 font-mono text-mid">{formatPrice(f.price)}</td>
                    <td className="px-5 py-2.5 font-mono">{formatQty(f.quantity)}</td>
                    <td className="px-5 py-2.5 font-mono">{formatNotional(f.notional)}</td>
                    <td className="px-5 py-2.5">
                      <TraderChip name={f.counterpartyLabel} />
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-soft">
                      {formatTime(f.settledAt)}
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
