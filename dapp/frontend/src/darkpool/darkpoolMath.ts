import type { Balance, PlaceOrderRequest, Pool, Side } from './types'

export const floorTo10 = (x: number): number => {
  const factor = 1e10
  return Math.floor(x * factor) / factor
}

export const midpointPrice = (buyLimit: number, sellLimit: number): number =>
  floorTo10((buyLimit + sellLimit) / 2)

export const crosses = (buyLimit: number, sellLimit: number): boolean => buyLimit >= sellLimit

export const fillQuantity = (buyQty: number, sellQty: number): number => Math.min(buyQty, sellQty)

export const remainderQuantity = (
  quantity: number,
  fillQty: number,
  minFill: number,
): number | null => {
  // round (not floor) at 10 dp: the contract subtracts exact decimals, so this
  // recovers the intended value from float drift (e.g. 0.5 - 0.45).
  const rest = Math.round((quantity - fillQty) * 1e10) / 1e10
  return rest >= minFill ? rest : null
}

export const quoteAmount = (qty: number, price: number): number => floorTo10(qty * price)

export const buyFundingTarget = (qty: number, limit: number): number => quoteAmount(qty, limit)

export const priceWithinLimit = (side: Side, execPrice: number, limit: number): boolean =>
  side === 'Buy' ? execPrice <= limit : execPrice >= limit

export type ValidationResult = { ok: true } | { ok: false; reason: string }

// Free (un-declared) balance of an instrument, looked up by its id.
export const freeOf = (balances: Balance[], instrumentId: string): number => {
  const b = balances.find((x) => x.instrument.id === instrumentId)
  return b ? b.total - b.declared : 0
}

export const validateOrder = (
  req: PlaceOrderRequest,
  pool: Pool,
  balances: Balance[],
): ValidationResult => {
  if (!(req.quantity > 0)) return { ok: false, reason: 'Enter a quantity' }
  if (!(req.limitPrice > 0)) return { ok: false, reason: 'Enter a limit price' }
  if (!(req.minFill > 0)) return { ok: false, reason: 'Enter a minimum fill' }
  if (req.minFill < pool.minFillFloor)
    return { ok: false, reason: `Min fill below pool floor (${pool.minFillFloor})` }
  if (req.minFill > req.quantity) return { ok: false, reason: 'Min fill exceeds quantity' }
  if (req.side === 'Sell') {
    if (freeOf(balances, pool.base.id) < req.quantity)
      return { ok: false, reason: `Insufficient ${pool.baseLabel}` }
  } else {
    if (freeOf(balances, pool.quote.id) < buyFundingTarget(req.quantity, req.limitPrice))
      return { ok: false, reason: `Insufficient ${pool.quoteLabel}` }
  }
  return { ok: true }
}
