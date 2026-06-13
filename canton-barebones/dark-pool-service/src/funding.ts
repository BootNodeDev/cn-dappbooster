// Select a party's holdings to cover an order's worst-case funding bound.
import { type Dec, parseDec, quoteAmount } from './decimal.ts'
import type { Holding, Side } from './types.ts'

// What the order must lock, per the contract's funding validation.
export const requiredFunding = (side: Side, quantity: string, limitPrice: string): Dec =>
  side === 'Buy' ? quoteAmount(parseDec(quantity), parseDec(limitPrice)) : parseDec(quantity)

const byAmountDesc = (a: Holding, b: Holding): number => {
  const amountA = parseDec(a.amount)
  const amountB = parseDec(b.amount)
  if (amountA > amountB) {
    return -1
  }
  if (amountA < amountB) {
    return 1
  }
  return 0
}

// Largest holdings first until the bound is covered; null when it cannot be.
export const selectFunding = (holdings: Holding[], required: Dec): string[] | null => {
  const sorted = [...holdings].sort(byAmountDesc)
  const total = sorted.reduce((sum, holding) => sum + parseDec(holding.amount), BigInt(0))
  if (total < required) {
    return null
  }
  const picked = sorted.reduce<{ cids: string[]; sum: Dec }>(
    (acc, holding) => {
      if (acc.sum >= required) {
        return acc
      }
      return { cids: [...acc.cids, holding.contractId], sum: acc.sum + parseDec(holding.amount) }
    },
    { cids: [], sum: BigInt(0) },
  )
  return picked.cids
}
