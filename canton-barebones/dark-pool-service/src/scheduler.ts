// One guarded runPass() is the venue's sole match writer: refresh → match each
// pool → settle each plan → sweep expired orders. A heartbeat and POST /venue/match
// both go through it, and every pass re-arms the timer to now + interval.
import { rejectOrder } from './commands.ts'
import type { Ledger } from './ledger.ts'
import { findMatches } from './matcher.ts'
import type { Projection } from './projection.ts'
import { type SettlementCtx, settle } from './settlement.ts'

export interface MatchedRow {
  poolId: string
  buyer: string
  seller: string
  price: string
  qty: string
}

export interface PassReport {
  ranAt: number
  matched: MatchedRow[]
  rejected: { cid: string; reason: string }[]
  skipped?: boolean
}

export interface Schedule {
  intervalMs: number
  nextRunAt: number | null
}

export interface Scheduler {
  runPass: () => Promise<PassReport>
  start: () => void
  stop: () => void
  setIntervalMs: (intervalMs: number) => Schedule
  schedule: () => Schedule
}

export interface SchedulerDeps {
  ledger: Ledger
  projection: Projection
  venue: string
  poolId: string
  poolCid: string
  factoryCid: string
  intervalMs: number
  now?: () => number
}

const expired =
  (now: number) =>
  (order: { expiresAt: number | null }): boolean =>
    order.expiresAt !== null && now >= order.expiresAt

export const createScheduler = (deps: SchedulerDeps): Scheduler => {
  const now = deps.now ?? (() => Date.now())
  let intervalMs = deps.intervalMs
  let nextRunAt: number | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false

  const settlementCtx = (): SettlementCtx => ({
    ledger: deps.ledger,
    projection: deps.projection,
    venue: deps.venue,
    poolCid: deps.poolCid,
    factoryCid: deps.factoryCid,
    now,
  })

  const sweepExpired = async (nowMs: number): Promise<{ cid: string; reason: string }[]> => {
    const stale = deps.projection.openOrders().filter(expired(nowMs))
    const rejections = await Promise.all(
      stale.map(async (order) => {
        await deps.ledger.submit(deps.venue, [rejectOrder(order.contractId)])
        return { cid: order.contractId, reason: 'expired' }
      }),
    )
    return rejections
  }

  const matchPool = async (nowMs: number): Promise<PassReport> => {
    const pool = deps.projection.pools().find((candidate) => candidate.poolId === deps.poolId)
    if (pool === undefined) {
      return { ranAt: nowMs, matched: [], rejected: [] }
    }
    const plans = findMatches(pool, deps.projection.openOrders(), nowMs)
    const ctx = settlementCtx()
    const outcomes = []
    for (const plan of plans) {
      outcomes.push(await settle(plan, ctx))
    }
    const matched = outcomes
      .map((outcome) => outcome.settled)
      .filter((trade) => trade !== null)
      .map((trade) => ({
        poolId: trade.poolId,
        buyer: trade.buyer,
        seller: trade.seller,
        price: trade.price,
        qty: trade.quantity,
      }))
    const rejected = outcomes
      .map((outcome) => outcome.rejected)
      .filter((rejection): rejection is { cid: string; reason: string } => rejection !== null)
    return { ranAt: nowMs, matched, rejected }
  }

  const reArm = (): void => {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
    nextRunAt = now() + intervalMs
    timer = setTimeout(() => {
      void runPass()
    }, intervalMs)
  }

  // Settle sequentially so each plan sees the prior plan's effects (single writer).
  const runPass = async (): Promise<PassReport> => {
    if (running) {
      return { ranAt: now(), matched: [], rejected: [], skipped: true }
    }
    running = true
    try {
      await deps.projection.refresh()
      const nowMs = now()
      const matchReport = await matchPool(nowMs)
      const sweepRejections = await sweepExpired(nowMs)
      return { ...matchReport, rejected: [...matchReport.rejected, ...sweepRejections] }
    } finally {
      running = false
      reArm()
    }
  }

  return {
    runPass,
    start: () => {
      reArm()
    },
    stop: () => {
      if (timer !== undefined) {
        clearTimeout(timer)
        timer = undefined
      }
      nextRunAt = null
    },
    setIntervalMs: (next) => {
      intervalMs = next
      reArm()
      return { intervalMs, nextRunAt }
    },
    schedule: () => ({ intervalMs, nextRunAt }),
  }
}
