// findMatches is pure and deterministic; every MatchPlan it returns already
// satisfies the contract's match preconditions (spec §3), so a settlement can
// only fail on a genuine race, never on matcher logic.
import assert from 'node:assert/strict'
import { crosses, type Dec, fillQuantity, parseDec, toDec } from './decimal.ts'
import type { MatchPlan, OrderContract } from './types.ts'

type PoolKey = { poolId: string; minFillFloor: string }
type Pass = { plans: MatchPlan[]; usedSells: Set<string> }

const isLive = (order: OrderContract, now: number): boolean =>
  order.expiresAt === null || now < order.expiresAt

// Best price first; ties broken by oldest creation offset (price-time priority).
const byPriority =
  (direction: 1 | -1) =>
  (a: OrderContract, b: OrderContract): number => {
    const priceA = parseDec(a.limitPrice)
    const priceB = parseDec(b.limitPrice)
    if (priceA > priceB) {
      return -direction
    }
    if (priceA < priceB) {
      return direction
    }
    return a.createdOffset - b.createdOffset
  }

// First resting sell that can fill this buy: still open, a different trader, crossing.
const counterparty = (
  buy: OrderContract,
  sells: OrderContract[],
  usedSells: Set<string>,
): OrderContract | undefined =>
  sells.find(
    (sell) =>
      !usedSells.has(sell.contractId) &&
      sell.trader !== buy.trader &&
      crosses(parseDec(buy.limitPrice), parseDec(sell.limitPrice)),
  )

const eligible = (fill: Dec, buy: OrderContract, sell: OrderContract, floor: Dec): boolean =>
  fill >= parseDec(buy.minFill) &&
  fill >= parseDec(sell.minFill) &&
  parseDec(buy.minFill) >= floor &&
  parseDec(sell.minFill) >= floor

const considerBuy =
  (pool: PoolKey, sells: OrderContract[], floor: Dec) =>
  (pass: Pass, buy: OrderContract): Pass => {
    const sell = counterparty(buy, sells, pass.usedSells)
    if (sell === undefined) {
      return pass
    }
    const fill = fillQuantity(parseDec(buy.quantity), parseDec(sell.quantity))
    if (!eligible(fill, buy, sell, floor)) {
      return pass
    }
    const plan: MatchPlan = {
      poolId: pool.poolId,
      buyOrderCid: buy.contractId,
      sellOrderCid: sell.contractId,
      fillQty: toDec(fill),
    }
    return { plans: [...pass.plans, plan], usedSells: new Set(pass.usedSells).add(sell.contractId) }
  }

export const findMatches = (pool: PoolKey, orders: OrderContract[], now: number): MatchPlan[] => {
  const inPool = orders.filter((order) => order.poolId === pool.poolId && isLive(order, now))
  assert(
    inPool.every((order) => parseDec(order.quantity) > BigInt(0)),
    'matcher: every order must have positive quantity',
  )
  const floor = parseDec(pool.minFillFloor)
  const buys = inPool.filter((order) => order.side === 'Buy').sort(byPriority(1))
  const sells = inPool.filter((order) => order.side === 'Sell').sort(byPriority(-1))
  return buys.reduce<Pass>(considerBuy(pool, sells, floor), { plans: [], usedSells: new Set() })
    .plans
}
