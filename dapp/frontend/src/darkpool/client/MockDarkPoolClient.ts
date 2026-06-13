import {
  crosses,
  fillQuantity,
  midpointPrice,
  priceWithinLimit,
  quoteAmount,
  remainderQuantity,
  validateOrder,
} from '../darkpoolMath'
import { COUNTERPARTIES, POOL_MIDS, POOLS, seedBalances, seedOrders, seedTrades } from '../seed'
import type {
  Balance,
  DarkPoolClient,
  Fill,
  MatchResult,
  Order,
  PlaceOrderRequest,
  Pool,
  Trade,
} from '../types'

export class MockDarkPoolClient implements DarkPoolClient {
  private pools: Pool[] = POOLS
  private orders: Order[]
  private trades: Trade[]
  private balances = new Map<string, Balance[]>()
  private fills = new Map<string, Fill[]>()
  private listeners = new Set<() => void>()
  private seq = 0
  private clock: () => number
  // Snapshot versioning so useSyncExternalStore gets a stable reference within a
  // version and a fresh one after any mutation (avoids both stale reads and render loops).
  private version = 0
  private snapshots = new Map<string, { version: number; value: unknown }>()
  // Off in deterministic test mode (start=0); on in the app so a freshly
  // connected trader sees populated open-orders and fills instead of empty panels.
  private demoSeed: boolean
  private demoSeeded = new Set<string>()

  constructor(start = 0) {
    let t = start
    this.clock = () => {
      if (start === 0) {
        t += 1000
        return t
      }
      return Date.now()
    }
    const now = start || Date.now()
    this.orders = seedOrders(now)
    this.trades = seedTrades(now)
    this.balances.set('alice', seedBalances())
    // Start past the seed's numeric suffixes (s1/s2/b1/b2/t1/t2) so generated
    // ids never collide with seeded ones (which would dupe React keys).
    this.seq = 100
    this.demoSeed = start !== 0
  }

  private id(prefix: string): string {
    this.seq += 1
    return `${prefix}${this.seq}`
  }

  private notify(): void {
    this.version += 1
    for (const l of this.listeners) l()
  }

  private memo<T>(key: string, compute: () => T): T {
    const hit = this.snapshots.get(key)
    if (hit && hit.version === this.version) return hit.value as T
    const value = compute()
    this.snapshots.set(key, { version: this.version, value })
    return value
  }

  private poolOf(poolId: string): Pool {
    const p = this.pools.find((x) => x.poolId === poolId)
    if (!p) throw new Error('unknown pool')
    return p
  }

  private balancesOf(party: string): Balance[] {
    if (!this.balances.has(party)) this.balances.set(party, seedBalances())
    return this.balances.get(party) as Balance[]
  }

  // First time we see a human trader (not a sim counterparty), give them a
  // couple of resting orders and past fills so the trade view isn't empty.
  // Runs in the same render before the relevant memo computes; no notify needed.
  private ensureParty(party: string): void {
    if (this.demoSeeded.has(party)) return
    this.demoSeeded.add(party)
    this.balancesOf(party)
    if (!this.demoSeed || (COUNTERPARTIES as readonly string[]).includes(party)) return
    const pool = this.pools[0]
    const mid = POOL_MIDS[pool.poolId] ?? 1
    const now = this.clock()
    const place = (side: 'Buy' | 'Sell', quantity: number, limitPrice: number): void => {
      if (side === 'Buy') this.adjust(party, pool.quoteLabel, 0, quoteAmount(quantity, limitPrice))
      else this.adjust(party, pool.baseLabel, 0, quantity)
      this.orders.push({
        orderId: this.id('o'),
        poolId: pool.poolId,
        trader: party,
        side,
        quantity,
        limitPrice,
        minFill: 1,
        expiresAt: now + 60 * 60_000,
        submittedAt: now - 30_000,
      })
    }
    place('Buy', 6, mid - 0.05)
    place('Sell', 4, mid + 0.15)
    this.recordFill(party, {
      fillId: this.id('f'),
      poolId: pool.poolId,
      side: 'Buy',
      price: mid,
      quantity: 5,
      notional: quoteAmount(5, mid),
      counterpartyLabel: 'bob',
      settledAt: now - 300_000,
    })
    this.recordFill(party, {
      fillId: this.id('f'),
      poolId: pool.poolId,
      side: 'Sell',
      price: mid + 0.08,
      quantity: 3,
      notional: quoteAmount(3, mid + 0.08),
      counterpartyLabel: 'carol',
      settledAt: now - 180_000,
    })
  }

  private adjust(party: string, label: string, dTotal: number, dDeclared: number): void {
    const b = this.balancesOf(party).find((x) => x.label === label)
    if (!b) return
    b.total += dTotal
    b.declared += dDeclared
  }

  listPools(): Pool[] {
    return this.pools
  }

  getBalances(party: string): Balance[] {
    this.ensureParty(party)
    return this.memo(`bal:${party}`, () => this.balancesOf(party).map((b) => ({ ...b })))
  }

  listMyOrders(party: string): Order[] {
    this.ensureParty(party)
    return this.memo(`orders:${party}`, () => this.orders.filter((o) => o.trader === party))
  }

  listMyFills(party: string): Fill[] {
    this.ensureParty(party)
    return this.memo(`fills:${party}`, () => [...(this.fills.get(party) ?? [])])
  }

  listBook(poolId: string): Order[] {
    return this.memo(`book:${poolId}`, () => this.orders.filter((o) => o.poolId === poolId))
  }

  listTrades(poolId: string): Trade[] {
    return this.memo(`trades:${poolId}`, () => this.trades.filter((t) => t.poolId === poolId))
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  placeOrder(party: string, req: PlaceOrderRequest): Promise<Order> {
    this.ensureParty(party)
    const pool = this.poolOf(req.poolId)
    const v = validateOrder(req, pool, this.balancesOf(party))
    if (!v.ok) return Promise.reject(new Error(v.reason))
    if (req.side === 'Buy')
      this.adjust(party, pool.quoteLabel, 0, quoteAmount(req.quantity, req.limitPrice))
    else this.adjust(party, pool.baseLabel, 0, req.quantity)
    const order: Order = {
      orderId: this.id('o'),
      poolId: req.poolId,
      trader: party,
      side: req.side,
      quantity: req.quantity,
      limitPrice: req.limitPrice,
      minFill: req.minFill,
      expiresAt: req.expiresAt,
      submittedAt: this.clock(),
    }
    this.orders.push(order)
    this.notify()
    return Promise.resolve(order)
  }

  cancelOrder(party: string, orderId: string): Promise<void> {
    const o = this.orders.find((x) => x.orderId === orderId && x.trader === party)
    if (!o) return Promise.reject(new Error('order not found'))
    const pool = this.poolOf(o.poolId)
    if (o.side === 'Buy')
      this.adjust(party, pool.quoteLabel, 0, -quoteAmount(o.quantity, o.limitPrice))
    else this.adjust(party, pool.baseLabel, 0, -o.quantity)
    this.orders = this.orders.filter((x) => x.orderId !== orderId)
    this.notify()
    return Promise.resolve()
  }

  matchOrders(buyOrderId: string, sellOrderId: string): Promise<MatchResult> {
    const buy = this.orders.find((o) => o.orderId === buyOrderId)
    const sell = this.orders.find((o) => o.orderId === sellOrderId)
    if (!buy || !sell) return Promise.reject(new Error('order not found'))
    if (buy.side !== 'Buy' || sell.side !== 'Sell')
      return Promise.reject(new Error('need one buy and one sell'))
    if (buy.trader === sell.trader) return Promise.reject(new Error('cannot self-match'))
    if (buy.poolId !== sell.poolId) return Promise.reject(new Error('different pools'))
    if (!crosses(buy.limitPrice, sell.limitPrice))
      return Promise.reject(new Error('limits do not cross'))
    const pool = this.poolOf(buy.poolId)
    const execPrice = midpointPrice(buy.limitPrice, sell.limitPrice)
    const fillQty = fillQuantity(buy.quantity, sell.quantity)
    if (fillQty < buy.minFill || fillQty < sell.minFill)
      return Promise.reject(new Error('below min fill'))
    if (
      !priceWithinLimit('Buy', execPrice, buy.limitPrice) ||
      !priceWithinLimit('Sell', execPrice, sell.limitPrice)
    )
      return Promise.reject(new Error('price outside limit'))
    const notional = quoteAmount(fillQty, execPrice)

    this.adjust(buy.trader, pool.quoteLabel, -notional, -quoteAmount(fillQty, buy.limitPrice))
    this.adjust(buy.trader, pool.baseLabel, fillQty, 0)
    this.adjust(sell.trader, pool.baseLabel, -fillQty, -fillQty)
    this.adjust(sell.trader, pool.quoteLabel, notional, 0)

    const now = this.clock()
    this.trades.unshift({
      tradeId: this.id('t'),
      poolId: pool.poolId,
      price: execPrice,
      quantity: fillQty,
      buyer: buy.trader,
      seller: sell.trader,
      settledAt: now,
    })
    // Settlement reveals the counterparty to each side (as the contract does).
    const label = (party: string): string => party.split('::')[0]
    this.recordFill(buy.trader, {
      fillId: this.id('f'),
      poolId: pool.poolId,
      side: 'Buy',
      price: execPrice,
      quantity: fillQty,
      notional,
      counterpartyLabel: label(sell.trader),
      settledAt: now,
    })
    this.recordFill(sell.trader, {
      fillId: this.id('f'),
      poolId: pool.poolId,
      side: 'Sell',
      price: execPrice,
      quantity: fillQty,
      notional,
      counterpartyLabel: label(buy.trader),
      settledAt: now,
    })

    const buyRemainder = this.reRest(buy, fillQty)
    const sellRemainder = this.reRest(sell, fillQty)
    this.orders = this.orders.filter((o) => o.orderId !== buy.orderId && o.orderId !== sell.orderId)
    if (buyRemainder) this.orders.push(buyRemainder)
    if (sellRemainder) this.orders.push(sellRemainder)
    this.notify()
    return Promise.resolve({ execPrice, fillQty, buyRemainder, sellRemainder })
  }

  private recordFill(party: string, fill: Fill): void {
    const arr = this.fills.get(party) ?? []
    arr.unshift(fill)
    this.fills.set(party, arr)
  }

  private reRest(order: Order, fillQty: number): Order | null {
    // Same remainder rule the venue preview shows, so they never diverge.
    const rest = remainderQuantity(order.quantity, fillQty, order.minFill)
    if (rest === null) return null
    return { ...order, orderId: this.id('o'), quantity: rest, submittedAt: this.clock() }
  }
}
