import { formatPrice } from '@/darkpool/format'
import { useTrades } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

const W = 760
const H = 200

export const ClearingChart = ({ pool }: { pool: Pool }): JSX.Element => {
  // oldest -> newest, capped to the most recent 30 fills
  const series = useTrades(pool.poolId)
    .slice(0, 30)
    .map((t) => t.price)
    .reverse()

  let body: JSX.Element
  if (series.length < 2) {
    body = (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        Awaiting first fill…
      </div>
    )
  } else {
    const min = Math.min(...series)
    const max = Math.max(...series)
    const span = max - min || 1
    const pad = 24
    const x = (i: number): number => pad + (i / (series.length - 1)) * (W - pad * 2)
    const y = (v: number): number => H - pad - ((v - min) / span) * (H - pad * 2)
    const line = series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(' ')
    const area = `${line} L ${x(series.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`
    const lastX = x(series.length - 1)
    const lastY = y(series[series.length - 1])
    body = (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[200px] w-full"
        role="img"
        aria-label="Clearing price over recent fills"
      >
        <title>Clearing price over recent fills</title>
        <defs>
          <linearGradient id={`cc-fill-${pool.poolId}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#cc-fill-${pool.poolId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--color-primary)">
          <animate attributeName="r" values="3.5;6;3.5" dur="1.8s" repeatCount="indefinite" />
        </circle>
      </svg>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="mb-3">
        <h2 className="font-display text-base font-semibold text-foreground">Clearing price</h2>
        <span className="text-xs text-soft">
          {series.length > 0
            ? `recent fills · last ${series.length} · midpoint`
            : 'midpoint settlement'}
        </span>
      </div>
      {body}
      {series.length > 0 && (
        <div className="mt-1 text-right font-mono text-xs text-muted-foreground">
          {formatPrice(series[series.length - 1])} {pool.quoteLabel}
        </div>
      )}
    </section>
  )
}
