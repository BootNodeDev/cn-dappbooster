import { crosses } from '../darkpoolMath'
import { COUNTERPARTIES, POOL_MIDS, POOLS } from '../seed'
import type { MockDarkPoolClient } from './MockDarkPoolClient'

// Drives the mock so the book, fills, balances and chart move on their own.
// Deleted together with the mock when the real ledger client lands.
export const startSimEngine = (client: MockDarkPoolClient): (() => void) => {
  const reduced =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (reduced) return () => {}

  const round2 = (x: number): number => Math.round(x * 100) / 100
  let n = 0
  const tick = (): void => {
    n += 1
    const pool = POOLS[0]
    const mid = POOL_MIDS[pool.poolId]
    const party = COUNTERPARTIES[n % COUNTERPARTIES.length]
    const side = n % 2 === 0 ? 'Buy' : 'Sell'
    const drift = Math.sin(n / 3) * mid * 0.03
    // buys sit just above the mid, sells just below, so the matcher finds crosses
    const limitPrice = round2(side === 'Buy' ? mid + drift + mid * 0.02 : mid + drift - mid * 0.02)
    const quantity = 2 + (n % 6)
    client
      .placeOrder(party, {
        poolId: pool.poolId,
        side,
        limitPrice,
        quantity,
        minFill: 1,
        expiresAt: null,
      })
      .catch(() => {})

    const book = client.listBook(pool.poolId)
    const buys = book.filter((o) => o.side === 'Buy').sort((a, b) => b.limitPrice - a.limitPrice)
    const sells = book.filter((o) => o.side === 'Sell').sort((a, b) => a.limitPrice - b.limitPrice)
    for (const b of buys) {
      const s = sells.find((x) => x.trader !== b.trader && crosses(b.limitPrice, x.limitPrice))
      if (s) {
        client.matchOrders(b.orderId, s.orderId).catch(() => {})
        break
      }
    }
  }

  const handle = setInterval(tick, 3000)
  return () => clearInterval(handle)
}
