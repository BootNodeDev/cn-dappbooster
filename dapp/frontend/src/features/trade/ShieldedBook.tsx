import { AnimatePresence, motion } from 'framer-motion'
import { type CSSProperties, useRef } from 'react'
import { Tooltip } from '@/components/ui/Tooltip'
import { formatPrice } from '@/darkpool/format'
import { useBook, useTrades } from '@/darkpool/hooks'
import type { Pool } from '@/darkpool/types'

// deterministic pseudo-random so the field is stable across renders
const rand = (i: number): number => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

type Particle = {
  x: number
  y: number
  r: number
  o: number
  bid: boolean
  dur: number
  delay: number
}

const FIELD: Particle[] = Array.from({ length: 44 }, (_, i) => {
  const bid = i % 2 === 0
  const depth = rand(i) // 0 near surface, 1 deep
  const spread = 6 + rand(i + 7) * 38 // distance from the central axis (%)
  const x = bid ? 50 - spread : 50 + spread
  return {
    x,
    y: 12 + rand(i + 3) * 76, // vertical position (%)
    r: 1.3 + (1 - depth) * 2.6, // nearer = bigger
    o: 0.12 + (1 - depth) * 0.5, // nearer = brighter
    bid,
    dur: 7 + rand(i + 11) * 7,
    delay: rand(i + 5) * -8,
  }
})

export const ShieldedBook = ({ pool }: { pool: Pool }): JSX.Element => {
  const resting = useBook(pool.poolId).length
  const trades = useTrades(pool.poolId)
  const mid = trades[0]?.price ?? null
  // ripple key bumps whenever a new trade settles
  const prev = useRef(trades.length)
  const rippleKey = useRef(0)
  if (trades.length > prev.current) rippleKey.current += 1
  prev.current = trades.length

  return (
    <section className="relative flex min-h-[420px] grow flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="z-10 flex items-center gap-2 px-5 pt-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Shielded book</h2>
        <Tooltip
          label="About the shielded book"
          content="This book is private. There's no public depth to read, you can't be front-run, and no one sees your size."
        />
        <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[0.7rem] font-semibold text-primary">
          <span className="size-1.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
          matcher live
        </span>
      </div>

      <div className="relative grow">
        <div className="-translate-x-1/2 absolute top-6 bottom-10 left-1/2 w-px bg-gradient-to-b from-transparent via-primary/40 to-transparent" />

        {/* drifting hidden liquidity (GPU-friendly CSS animation) */}
        {FIELD.map((p, i) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: stable generated field
            key={i}
            className="dp-particle absolute rounded-full"
            style={
              {
                left: `${p.x}%`,
                top: `${p.y}%`,
                width: p.r * 2,
                height: p.r * 2,
                backgroundColor: p.bid ? 'var(--color-up)' : 'var(--color-down)',
                filter: 'blur(0.5px)',
                '--dp-o': p.o,
                '--dp-dur': `${p.dur}s`,
                '--dp-delay': `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}

        {/* bloom + the gold midpoint at the heart of the book */}
        <div className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 flex flex-col items-center">
          <motion.div
            className="-z-10 absolute size-40 rounded-full"
            style={{
              background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 65%)',
            }}
            animate={{ opacity: [0.18, 0.32, 0.18], scale: [0.92, 1.04, 0.92] }}
            transition={{ duration: 4, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />
          <AnimatePresence>
            <motion.div
              key={rippleKey.current}
              className="absolute size-24 rounded-full border border-mid/50"
              initial={{ scale: 0.4, opacity: 0.6 }}
              animate={{ scale: 2.6, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut' }}
            />
          </AnimatePresence>
          <span className="font-display text-[0.6rem] uppercase tracking-[0.2em] text-soft">
            midpoint
          </span>
          <span className="font-display font-semibold text-4xl text-mid tabular drop-shadow-[0_0_24px_var(--color-mid-soft)]">
            {mid === null ? '—' : formatPrice(mid)}
          </span>
          <span className="font-mono text-[0.7rem] text-muted-foreground">{pool.quoteLabel}</span>
        </div>

        {/* depth fog: particles dissolve into the deep */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-surface to-transparent" />
      </div>

      <div className="z-10 px-5 pb-5 text-center">
        <span className="text-xs text-muted-foreground">
          Liquidity resting in the dark ·{' '}
          <span className="font-mono text-foreground">{resting}</span> orders concealed
        </span>
      </div>
    </section>
  )
}
