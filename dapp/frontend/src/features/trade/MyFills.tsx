import { AnimatePresence, motion } from 'framer-motion'
import { TraderFace } from '@/components/TraderFace'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatNotional, formatPrice, formatQty } from '@/darkpool/format'
import { useMyFills } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

const time = (ms: number): string => new Date(ms).toLocaleTimeString('en-US', { hour12: false })

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
              <th className="px-5 py-2 font-semibold">Side</th>
              <th className="px-5 py-2 font-semibold">Clearing price</th>
              <th className="px-5 py-2 font-semibold">Quantity</th>
              <th className="px-5 py-2 font-semibold">Notional</th>
              <th className="px-5 py-2 font-semibold">Counterparty</th>
              <th className="px-5 py-2 text-right font-semibold">Settled</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {fills.map((f) => {
                const isBuy = f.side === 'Buy'
                return (
                  <motion.tr
                    key={f.fillId}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-border/60 text-sm last:border-b-0"
                  >
                    <td className="px-5 py-2.5">
                      <span className={`font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
                        {isBuy ? '▲ Buy' : '▼ Sell'}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 font-mono text-mid">{formatPrice(f.price)}</td>
                    <td className="px-5 py-2.5 font-mono">{formatQty(f.quantity)}</td>
                    <td className="px-5 py-2.5 font-mono">{formatNotional(f.notional)}</td>
                    <td className="px-5 py-2.5">
                      <span className="inline-flex items-center gap-2 font-mono text-muted-foreground">
                        <span className="overflow-hidden rounded-full">
                          <TraderFace name={f.counterpartyLabel} size={18} />
                        </span>
                        {f.counterpartyLabel}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-right font-mono text-soft">
                      {time(f.settledAt)}
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
