const price = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const qty = new Intl.NumberFormat('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

export const formatPrice = (n: number): string => price.format(n)
export const formatNotional = (n: number): string => price.format(n)
export const formatQty = (n: number): string => qty.format(n)
