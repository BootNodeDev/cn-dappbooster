// Truncate to `dp` decimals (never rounds up, matching the contracts' floor rule),
// then group with thousands separators.
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

// Settlement timestamp as a 24h clock.
export const formatTime = (ms: number): string =>
  new Date(ms).toLocaleTimeString('en-US', { hour12: false })

// Short trader name: the part before the Canton namespace separator.
export const partyName = (party: string): string => party.split('::')[0]
