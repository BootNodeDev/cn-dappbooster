// Exact 10-dp decimals mirroring DarkPool/Math.daml so off-ledger math agrees
// with the contract bit-for-bit. Values are BigInt scaled by 10^10, never floats.

const SCALE = 10
const FACTOR = BigInt(10) ** BigInt(SCALE)

export type Dec = bigint // value * 10^10

export const parseDec = (s: string): Dec => {
  const neg = s.startsWith('-')
  const [intPart, fracPart = ''] = (neg ? s.slice(1) : s).split('.')
  const frac = (fracPart + '0'.repeat(SCALE)).slice(0, SCALE)
  const value = BigInt(intPart || '0') * FACTOR + BigInt(frac || '0')
  return neg ? -value : value
}

export const toDec = (d: Dec): string => {
  const neg = d < BigInt(0)
  const value = neg ? -d : d
  const intPart = value / FACTOR
  const frac = (value % FACTOR).toString().padStart(SCALE, '0')
  return `${neg ? '-' : ''}${intPart}.${frac}`
}

export const crosses = (buyLimit: Dec, sellLimit: Dec): boolean => buyLimit >= sellLimit

export const fillQuantity = (a: Dec, b: Dec): Dec => (a < b ? a : b)

// floorTo10 of the exact scale-20 product: division truncates toward zero, which
// equals floor for the non-negative amounts here.
export const quoteAmount = (qty: Dec, price: Dec): Dec => (qty * price) / FACTOR

// Execution price the contract derives: floorTo10((buyLimit + sellLimit) / 2).
export const midpointPrice = (buyLimit: Dec, sellLimit: Dec): Dec =>
  (buyLimit + sellLimit) / BigInt(2)

// Remainder re-rests only when it still meets the order's minFill.
export const remainderQuantity = (quantity: Dec, fillQty: Dec, minFill: Dec): Dec | null => {
  const rest = quantity - fillQty
  return rest >= minFill ? rest : null
}
