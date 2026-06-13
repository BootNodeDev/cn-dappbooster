import { useState } from 'react'
import { Select } from '@/components/ui/Select'
import { SideToggle } from '@/components/ui/SideToggle'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { buyFundingTarget, freeOf, quoteAmount, validateOrder } from '@/darkpool/darkpoolMath'
import { formatNotional, formatPrice, formatQty } from '@/darkpool/format'
import { useBalances, useDarkPoolActions, useTrades } from '@/darkpool/hooks'
import type { Pool, Side } from '@/darkpool/types'
import { errorMessage } from '@/utils/errorMessage'

const EXPIRY_OPTIONS = [
  { value: 'none', label: 'No expiry' },
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
  { value: '24h', label: '24 hours' },
]

const EXPIRY_MS: Record<string, number | null> = {
  none: null,
  '5m': 5 * 60_000,
  '1h': 60 * 60_000,
  '24h': 24 * 60 * 60_000,
}

export const OrderEntry = ({ pool, party }: { pool: Pool; party: string }): JSX.Element => {
  const balances = useBalances(party)
  const trades = useTrades(pool.poolId)
  const { placeOrder } = useDarkPoolActions()

  const [side, setSide] = useState<Side>('Buy')
  const [limitPrice, setLimitPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [minFill, setMinFill] = useState(String(pool.minFillFloor))
  const [expiry, setExpiry] = useState('1h')
  const [submitting, setSubmitting] = useState(false)

  const price = Number(limitPrice)
  const qty = Number(quantity)
  const min = Number(minFill)
  const mid = trades[0]?.price ?? null

  const req = {
    poolId: pool.poolId,
    side,
    limitPrice: price,
    quantity: qty,
    minFill: min,
    expiresAt: null as number | null,
  }
  const validity = validateOrder(req, pool, balances)
  const notional = qty > 0 && price > 0 ? quoteAmount(qty, price) : 0
  const funding = side === 'Buy' ? (qty > 0 && price > 0 ? buyFundingTarget(qty, price) : 0) : qty

  const setPercent = (pct: number): void => {
    const raw =
      side === 'Sell'
        ? freeOf(balances, pool.base.id) * pct
        : price > 0
          ? (freeOf(balances, pool.quote.id) * pct) / price
          : 0
    if (raw > 0) setQuantity(String(Math.floor(raw * 1e4) / 1e4))
  }

  const submit = async (): Promise<void> => {
    if (!validity.ok) return
    const ttl = EXPIRY_MS[expiry]
    setSubmitting(true)
    try {
      await placeOrder(party, { ...req, expiresAt: ttl === null ? null : Date.now() + ttl })
      toast.success(`Private ${side.toLowerCase()} order placed`)
      setQuantity('')
    } catch (e) {
      toast.error(errorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const buttonClass =
    side === 'Buy'
      ? 'bg-up text-background hover:brightness-110'
      : 'bg-down text-background hover:brightness-110'

  return (
    <section className="rounded-2xl border border-border border-l-2 border-l-primary bg-surface p-5">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-display text-base font-semibold text-foreground">
          Place private order
        </h2>
        <Tooltip
          label="About private orders"
          content="Funding is declared now but only locked when a match is found. No one sees this order but you and the venue."
        />
      </div>

      <SideToggle value={side} onChange={setSide} baseLabel={pool.baseLabel} />

      <div className="mt-4">
        <div className="mb-1.5 flex items-center gap-1.5">
          <label
            htmlFor="oe-price"
            className="!mb-0 text-[0.7rem] uppercase tracking-wider text-muted-foreground"
          >
            Limit price · {pool.quoteLabel} per {pool.baseLabel}
          </label>
          <Tooltip
            label="About the limit price"
            content="You'll never cross this. Fills clear at the midpoint."
          />
        </div>
        <input
          id="oe-price"
          inputMode="decimal"
          value={limitPrice}
          onChange={(e) => setLimitPrice(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      <div className="mt-3">
        <label
          htmlFor="oe-qty"
          className="!mb-1.5 text-[0.7rem] uppercase tracking-wider text-muted-foreground"
        >
          Quantity · {pool.baseLabel}
        </label>
        <input
          id="oe-qty"
          inputMode="decimal"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="0.00"
          className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary"
        />
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {[0.25, 0.5, 0.75, 1].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPercent(p)}
              className="rounded-md border border-border bg-muted py-1 text-xs text-muted-foreground transition hover:border-border-strong hover:text-foreground"
            >
              {p === 1 ? 'Max' : `${p * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <div>
          <label
            htmlFor="oe-minfill"
            className="!mb-1.5 text-[0.7rem] uppercase tracking-wider text-muted-foreground"
          >
            Min fill
          </label>
          <input
            id="oe-minfill"
            inputMode="decimal"
            value={minFill}
            onChange={(e) => setMinFill(e.target.value)}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2.5 font-mono text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Expiry
          </span>
          <Select
            value={expiry}
            onChange={setExpiry}
            options={EXPIRY_OPTIONS}
            ariaLabel="Order expiry"
          />
        </div>
      </div>

      <dl className="mt-4 rounded-lg border border-border bg-muted px-3.5 py-3 text-sm">
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Notional</dt>
          <dd className="font-mono">
            {formatNotional(notional)} {pool.quoteLabel}
          </dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Funding required</dt>
          <dd className="font-mono">
            {side === 'Buy'
              ? `${formatNotional(funding)} ${pool.quoteLabel}`
              : `${formatQty(funding)} ${pool.baseLabel}`}
          </dd>
        </div>
        <div className="flex justify-between py-0.5">
          <dt className="text-muted-foreground">Est. clearing</dt>
          <dd className="font-mono text-mid">{mid === null ? '—' : `~${formatPrice(mid)}`}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={submit}
        disabled={!validity.ok || submitting}
        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${buttonClass}`}
      >
        {submitting ? (
          <span
            role="status"
            aria-label="Placing order"
            className="size-4 animate-spin rounded-full border-2 border-background/30 border-t-background"
          />
        ) : validity.ok ? (
          `Place private ${side.toLowerCase()} order`
        ) : (
          validity.reason
        )}
      </button>
    </section>
  )
}
