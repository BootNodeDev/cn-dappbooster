import type { Side } from './types'

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
  const rest = floorTo10(quantity - fillQty)
  return rest >= minFill ? rest : null
}

export const quoteAmount = (qty: number, price: number): number => floorTo10(qty * price)

export const buyFundingTarget = (qty: number, limit: number): number => quoteAmount(qty, limit)

export const priceWithinLimit = (side: Side, execPrice: number, limit: number): boolean =>
  side === 'Buy' ? execPrice <= limit : execPrice >= limit
