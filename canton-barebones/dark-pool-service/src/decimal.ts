// Exact 10-dp decimals mirroring DarkPool/Math.daml so off-ledger math agrees
// with the contract bit-for-bit. Values are BigInt scaled by 10^10, never floats.

const SCALE = 10n
const FACTOR = 10n ** SCALE

export type Dec = bigint // value * 10^10

export const parseDec = (s: string): Dec => {
  const neg = s.startsWith('-')
  const [intPart, fracPart = ''] = (neg ? s.slice(1) : s).split('.')
  const frac = (fracPart + '0'.repeat(Number(SCALE))).slice(0, Number(SCALE))
  const value = BigInt(intPart || '0') * FACTOR + BigInt(frac || '0')
  return neg ? -value : value
}

export const toDec = (d: Dec): string => {
  const neg = d < 0n
  const value = neg ? -d : d
  const intPart = value / FACTOR
  const frac = (value % FACTOR).toString().padStart(Number(SCALE), '0')
  return `${neg ? '-' : ''}${intPart}.${frac}`
}

export const crosses = (buyLimit: Dec, sellLimit: Dec): boolean => buyLimit >= sellLimit

export const fillQuantity = (a: Dec, b: Dec): Dec => (a < b ? a : b)

// floorTo10 of the exact scale-20 product: division truncates toward zero, which
// equals floor for the non-negative amounts here.
export const quoteAmount = (qty: Dec, price: Dec): Dec => (qty * price) / FACTOR

// Remainder re-rests only when it still meets the order's minFill.
export const remainderQuantity = (quantity: Dec, fillQty: Dec, minFill: Dec): Dec | null => {
  const rest = quantity - fillQty
  return rest >= minFill ? rest : null
}
