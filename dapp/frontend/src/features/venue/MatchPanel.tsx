import { useState } from 'react'
import { toast } from '@/components/ui/toast'
import { crosses, fillQuantity, midpointPrice, remainderQuantity } from '@/darkpool/darkpoolMath'
import { formatPrice, formatQty } from '@/darkpool/format'
import { useDarkPoolActions } from '@/darkpool/hooks'
import type { Order, Pool } from '@/darkpool/types'
import { errorMessage } from '@/utils/errorMessage'

const Leg = ({ order, pool }: { order: Order | null; pool: Pool }): JSX.Element => {
  if (!order) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3.5 py-3 text-sm text-muted-foreground">
        Pick a {pool.baseLabel} order from the book
      </div>
    )
  }
  const isBuy = order.side === 'Buy'
  return (
    <div
      className={`rounded-lg border px-3.5 py-3 ${
        isBuy ? 'border-up/40 bg-success-soft' : 'border-down/40 bg-danger-soft'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold ${isBuy ? 'text-up' : 'text-down'}`}>
          {isBuy ? '▲ Buy' : '▼ Sell'} · {order.trader.split('::')[0]}
        </span>
        <span className="font-mono text-sm">
          {formatQty(order.quantity)} {pool.baseLabel}
        </span>
      </div>
      <div className="mt-1 flex justify-between text-sm">
        <span className="text-muted-foreground">Limit</span>
        <span className="font-mono">{formatPrice(order.limitPrice)}</span>
      </div>
    </div>
  )
}

export const MatchPanel = ({
  pool,
  buy,
  sell,
  onMatched,
}: {
  pool: Pool
  buy: Order | null
  sell: Order | null
  onMatched: () => void
}): JSX.Element => {
  const { matchOrders } = useDarkPoolActions()
  const [matching, setMatching] = useState(false)

  const ready = buy !== null && sell !== null
  const doesCross = ready ? crosses(buy.limitPrice, sell.limitPrice) : false
  const exec = ready && doesCross ? midpointPrice(buy.limitPrice, sell.limitPrice) : null
  const fill = ready && doesCross ? fillQuantity(buy.quantity, sell.quantity) : null
  const buyRest = ready && fill !== null ? remainderQuantity(buy.quantity, fill, buy.minFill) : null
  const sellRest =
    ready && fill !== null ? remainderQuantity(sell.quantity, fill, sell.minFill) : null
  const belowMin = ready && fill !== null && (fill < buy.minFill || fill < sell.minFill)
  const canMatch = ready && doesCross && !belowMin && !matching

  const reason = !ready
    ? 'Select a buy and a sell'
    : !doesCross
      ? 'Limits do not cross'
      : belowMin
        ? 'Fill below a min fill'
        : null

  const execute = async (): Promise<void> => {
    if (!buy || !sell) return
    setMatching(true)
    try {
      const result = await matchOrders(buy.orderId, sell.orderId)
      toast.success(
        `Matched ${formatQty(result.fillQty)} ${pool.baseLabel} at ${formatPrice(result.execPrice)}`,
      )
      onMatched()
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setMatching(false)
    }
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5 shadow-[0_0_40px_-12px_var(--color-primary)]">
      <h2 className="font-display text-base font-semibold text-foreground">Match orders</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Pick one buy and one sell whose limits cross. Settlement is atomic at the midpoint.
      </p>

      <div className="mt-4 space-y-2">
        <Leg order={buy} pool={pool} />
        <div className="text-center text-soft">⇅</div>
        <Leg order={sell} pool={pool} />
      </div>

      <dl className="mt-4 rounded-lg border border-border bg-muted px-3.5 py-3 text-sm">
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Limits cross?</dt>
          <dd className={`font-semibold ${doesCross ? 'text-primary' : 'text-down'}`}>
            {ready ? (doesCross ? '✓ yes' : '✗ no') : '—'}
          </dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Midpoint price</dt>
          <dd className="font-mono text-primary">{exec === null ? '—' : formatPrice(exec)}</dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Fill quantity</dt>
          <dd className="font-mono">
            {fill === null ? '—' : `${formatQty(fill)} ${pool.baseLabel}`}
          </dd>
        </div>
        {(buyRest !== null || sellRest !== null) && (
          <div className="flex justify-between py-0.5">
            <dt className="text-muted-foreground">Re-rests</dt>
            <dd className="font-mono text-soft">
              {buyRest !== null ? `buy ${formatQty(buyRest)}` : ''}
              {buyRest !== null && sellRest !== null ? ' · ' : ''}
              {sellRest !== null ? `sell ${formatQty(sellRest)}` : ''}
            </dd>
          </div>
        )}
      </dl>

      <button
        type="button"
        onClick={execute}
        disabled={!canMatch}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55"
      >
        {matching ? (
          <span
            role="status"
            aria-label="Settling match"
            className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground"
          />
        ) : (
          (reason ?? 'Execute atomic match')
        )}
      </button>
      <p className="mt-2.5 text-center text-xs text-soft">
        Both legs settle in one transaction or neither does.
      </p>
    </section>
  )
}
