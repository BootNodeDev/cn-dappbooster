import { useBook } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

const BIDS = [90, 70, 80, 55, 64]
const ASKS = [60, 78, 50, 84, 66]

const Bars = ({ widths, align }: { widths: number[]; align: 'left' | 'right' }): JSX.Element => (
  <div className={`mt-2.5 flex flex-col gap-2 ${align === 'right' ? 'items-end' : ''}`}>
    {widths.map((w, i) => (
      <div
        // biome-ignore lint/suspicious/noArrayIndexKey: decorative static bars
        key={i}
        style={{ width: `${w}%` }}
        className="h-2 rounded bg-gradient-to-r from-primary/40 to-primary blur-[3px]"
      />
    ))}
  </div>
)

export const ShieldedBook = ({ pool }: { pool: Pool }): JSX.Element => {
  const resting = useBook(pool.poolId).length
  return (
    <section className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold text-foreground">Shielded book</h2>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[0.7rem] font-semibold text-muted-foreground">
          🛡 private · no public depth
        </span>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Resting liquidity exists but stays hidden. You can't be front-run; counterparties can't see
        your size.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-6">
        <div>
          <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-up">
            Bids — hidden
          </span>
          <Bars widths={BIDS} align="left" />
        </div>
        <div>
          <span className="block text-right text-[0.7rem] font-semibold uppercase tracking-wider text-down">
            Asks — hidden
          </span>
          <Bars widths={ASKS} align="right" />
        </div>
      </div>
      <div className="mt-4 flex justify-center">
        <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs">
          <span className="size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
          {resting} orders resting · matcher live
        </span>
      </div>
    </section>
  )
}
