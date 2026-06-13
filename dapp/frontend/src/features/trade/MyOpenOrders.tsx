import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { formatPrice, formatQty } from '@/darkpool/format'
import { useDarkPoolActions, useMyOrders } from '@/darkpool/hooks'
import type { Order, Pool } from '@/darkpool/types'
import { errorMessage } from '@/utils/errorMessage'

const expiryLabel = (expiresAt: number | null): string => {
  if (expiresAt === null) return 'no expiry'
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'expired'
  const mins = Math.round(ms / 60_000)
  return mins >= 60 ? `in ${Math.round(mins / 60)}h` : `in ${mins}m`
}

const OrderRow = ({
  order,
  pool,
  party,
}: {
  order: Order
  pool: Pool
  party: string
}): JSX.Element => {
  const { cancelOrder } = useDarkPoolActions()
  const [cancelling, setCancelling] = useState(false)
  const isBuy = order.side === 'Buy'

  const cancel = async (): Promise<void> => {
    setCancelling(true)
    try {
      await cancelOrder(party, order.orderId)
      toast.success('Order cancelled')
    } catch (e) {
      toast.error(errorMessage(e))
      setCancelling(false)
    }
  }

  return (
    <motion.tr
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border-border/60 border-b text-sm last:border-b-0"
    >
      <td className="px-5 py-2.5">
        <span className={`font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
          {isBuy ? '▲ Buy' : '▼ Sell'}
        </span>
      </td>
      <td className="px-5 py-2.5 font-mono">{formatPrice(order.limitPrice)}</td>
      <td className="px-5 py-2.5 font-mono">
        {formatQty(order.quantity)} {pool.baseLabel}
      </td>
      <td className="px-5 py-2.5 font-mono text-soft">{formatQty(order.minFill)}</td>
      <td className="px-5 py-2.5 font-mono text-soft">{expiryLabel(order.expiresAt)}</td>
      <td className="px-5 py-2.5 text-right">
        <button
          type="button"
          onClick={cancel}
          disabled={cancelling}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground transition hover:border-border-strong disabled:opacity-55"
        >
          {cancelling ? (
            <span
              role="status"
              aria-label="Cancelling order"
              className="size-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground"
            />
          ) : (
            'Cancel'
          )}
        </button>
      </td>
    </motion.tr>
  )
}

export const MyOpenOrders = ({ pool, party }: { pool: Pool; party: string }): JSX.Element => {
  const orders = useMyOrders(party).filter((o) => o.poolId === pool.poolId)

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-5 py-3">
        <span className="font-display text-base font-semibold text-foreground">My open orders</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">No open orders</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-[0.65rem] uppercase tracking-wider text-soft">
              <th scope="col" className="px-5 py-2 font-semibold">
                Side
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Limit
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Quantity
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Min fill
              </th>
              <th scope="col" className="px-5 py-2 font-semibold">
                Expires
              </th>
              <th scope="col" className="px-5 py-2 text-right font-semibold">
                {''}
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {orders.map((o) => (
                <OrderRow key={o.orderId} order={o} pool={pool} party={party} />
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      )}
    </section>
  )
}
