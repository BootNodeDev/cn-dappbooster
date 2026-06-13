// Settles one MatchPlan via DarkPool_Match (actAs venue) and records the trade
// from the contract's authoritative MatchResult. Fail-closed: on error it
// refreshes the projection and reports the pair as rejected — never blind-retries.
import { createHash } from 'node:crypto'
import { match } from './commands.ts'
import { exerciseResult, type Ledger } from './ledger.ts'
import type { Projection } from './projection.ts'
import type { MatchPlan, Trade } from './types.ts'

const ALLOCATE_WINDOW_MS = 5 * 60 * 1000
const SETTLE_WINDOW_MS = 60 * 60 * 1000

type MatchResult = { execPrice: string; fillQty: string }

export interface SettlementCtx {
  ledger: Ledger
  projection: Projection
  venue: string
  poolCid: string
  factoryCid: string
  now: () => number
}

export interface SettleOutcome {
  settled: Trade | null
  rejected: { cid: string; reason: string } | null
}

// Deterministic so an ambiguous retry reuses the same matchId/command-id.
const matchIdOf = (buyOrderCid: string, sellOrderCid: string): string =>
  createHash('sha256').update(`${buyOrderCid}:${sellOrderCid}`).digest('hex').slice(0, 16)

const iso = (ms: number): string => new Date(ms).toISOString()

export const settle = async (plan: MatchPlan, ctx: SettlementCtx): Promise<SettleOutcome> => {
  const matchId = matchIdOf(plan.buyOrderCid, plan.sellOrderCid)
  const nowMs = ctx.now()
  const orders = ctx.projection.openOrders()
  const buyer = orders.find((order) => order.contractId === plan.buyOrderCid)?.trader
  const seller = orders.find((order) => order.contractId === plan.sellOrderCid)?.trader
  const command = match({
    poolCid: ctx.poolCid,
    buyOrderCid: plan.buyOrderCid,
    sellOrderCid: plan.sellOrderCid,
    matchId,
    factoryCid: ctx.factoryCid,
    requestedAt: iso(nowMs - 1000),
    allocateBefore: iso(nowMs + ALLOCATE_WINDOW_MS),
    settleBefore: iso(nowMs + SETTLE_WINDOW_MS),
  })
  try {
    const events = await ctx.ledger.submit(ctx.venue, [command])
    const result = exerciseResult(events, 'DarkPool_Match') as MatchResult
    const trade: Trade = {
      tradeId: matchId,
      poolId: plan.poolId,
      price: result.execPrice,
      quantity: result.fillQty,
      buyer: buyer ?? '',
      seller: seller ?? '',
      settledAt: nowMs,
    }
    ctx.projection.recordTrade(trade)
    return { settled: trade, rejected: null }
  } catch (error) {
    await ctx.projection.refresh()
    const reason = error instanceof Error ? error.message : String(error)
    return { settled: null, rejected: { cid: plan.buyOrderCid, reason } }
  }
}
