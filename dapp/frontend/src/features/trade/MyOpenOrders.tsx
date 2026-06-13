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
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="border-border border-b py-3 last:border-b-0"
    >
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
            isBuy
              ? 'border-up/40 bg-success-soft text-up'
              : 'border-down/40 bg-danger-soft text-down'
          }`}
        >
          {isBuy ? '▲' : '▼'} {order.side}
        </span>
        <span className="font-mono text-sm">
          {formatQty(order.quantity)} {pool.baseLabel}
        </span>
      </div>
      <dl className="mt-2 space-y-0.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Limit</dt>
          <dd className="font-mono">{formatPrice(order.limitPrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Min fill</dt>
          <dd className="font-mono">{formatQty(order.minFill)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Expires</dt>
          <dd className="font-mono">{expiryLabel(order.expiresAt)}</dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={cancel}
        disabled={cancelling}
        className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-muted py-2 text-sm text-foreground transition hover:border-border-strong disabled:opacity-55"
      >
        {cancelling && (
          <span className="size-3.5 animate-spin rounded-full border-2 border-foreground/30 border-t-foreground" />
        )}
        {cancelling ? 'Cancelling…' : 'Cancel order'}
      </button>
    </motion.li>
  )
}

export const MyOpenOrders = ({ pool, party }: { pool: Pool; party: string }): JSX.Element => {
  const orders = useMyOrders(party).filter((o) => o.poolId === pool.poolId)

  return (
    <section className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="text-sm font-semibold text-foreground">My open orders</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {orders.length}
        </span>
      </div>
      {orders.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No open orders</p>
      ) : (
        <ul className="px-4">
          <AnimatePresence initial={false}>
            {orders.map((o) => (
              <OrderRow key={o.orderId} order={o} pool={pool} party={party} />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </section>
  )
}
