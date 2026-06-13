// Truncate (never round up) to `dp` decimals, then group with thousands separators.
// Truncation matches the contracts' floor-everything philosophy: a displayed 1,000.98
// is never inflated to 1,000.99.
const truncateTo = (n: number, dp: number): number => {
  const factor = 10 ** dp
  return Math.trunc(n * factor) / factor
}

const grouped = (dp: number): Intl.NumberFormat =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp })

const num2 = grouped(2)

// All numeric values render grouped with exactly 2 dp, truncated.
export const formatPrice = (n: number): string => num2.format(truncateTo(n, 2))
export const formatNotional = (n: number): string => num2.format(truncateTo(n, 2))
export const formatQty = (n: number): string => num2.format(truncateTo(n, 2))
