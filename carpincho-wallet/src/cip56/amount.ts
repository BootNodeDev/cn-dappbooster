// Groups an integer string with comma thousands separators.
const groupThousands = (whole: string): string => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')

const DECIMAL_RE = /^\d+(\.\d+)?$/

// Formats a decimal token amount for display: two decimals, half-up rounding, and
// comma-grouped thousands. Falls back to the raw string for non-numeric values so
// labels like "unknown" pass through untouched. BigInt keeps precision past Number range.
export const formatTokenAmount = (value: string): string => {
  const trimmed = value.trim()
  if (!DECIMAL_RE.test(trimmed)) {
    return value
  }
  const [whole, fraction = ''] = trimmed.split('.')
  let cents = Number.parseInt(`${fraction}00`.slice(0, 2), 10)
  let wholeValue = BigInt(whole)
  // Round half up using the first dropped digit.
  if ((fraction[2] ?? '0') >= '5') {
    cents += 1
    if (cents === 100) {
      cents = 0
      wholeValue += 1n
    }
  }
  return `${groupThousands(wholeValue.toString())}.${cents.toString().padStart(2, '0')}`
}
