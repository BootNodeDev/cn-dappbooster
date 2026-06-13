import type { Balance, Order, Pool, Trade } from './types'

export const COUNTERPARTIES = ['bob', 'carol', 'dan'] as const

// Instruments mirror the contract test setup: Canton Coin (CC) is issued by the
// DSO/Amulet registry; the test tokens (TUSD, TTA, TTB) by a TestToken registry.
// No invented tickers — these are the instruments the contracts actually exercise.
const DSO = 'dso'
const REG = 'registry'

export const POOLS: Pool[] = [
  {
    poolId: 'CC-TUSD',
    base: { admin: DSO, id: 'CC' },
    quote: { admin: REG, id: 'TUSD' },
    baseLabel: 'CC',
    quoteLabel: 'TUSD',
    minFillFloor: 1,
  },
  {
    poolId: 'TTA-TTB',
    base: { admin: REG, id: 'TTA' },
    quote: { admin: REG, id: 'TTB' },
    baseLabel: 'TTA',
    quoteLabel: 'TTB',
    minFillFloor: 1,
  },
]

export const POOL_MIDS: Record<string, number> = { 'CC-TUSD': 2.5, 'TTA-TTB': 1.5 }

export const seedBalances = (): Balance[] => [
  { instrument: POOLS[0].base, label: 'CC', total: 1000, declared: 0 },
  { instrument: POOLS[0].quote, label: 'TUSD', total: 5000, declared: 0 },
  { instrument: POOLS[1].base, label: 'TTA', total: 800, declared: 0 },
  { instrument: POOLS[1].quote, label: 'TTB', total: 2000, declared: 0 },
]

export const seedOrders = (now: number): Order[] => [
  {
    orderId: 's1',
    poolId: 'CC-TUSD',
    trader: 'carol',
    side: 'Sell',
    quantity: 8,
    limitPrice: 2.6,
    minFill: 1,
    expiresAt: null,
    submittedAt: now - 9000,
  },
  {
    orderId: 's2',
    poolId: 'CC-TUSD',
    trader: 'bob',
    side: 'Sell',
    quantity: 5,
    limitPrice: 2.7,
    minFill: 1,
    expiresAt: null,
    submittedAt: now - 6000,
  },
  {
    orderId: 'b1',
    poolId: 'CC-TUSD',
    trader: 'bob',
    side: 'Buy',
    quantity: 6,
    limitPrice: 2.4,
    minFill: 1,
    expiresAt: null,
    submittedAt: now - 4000,
  },
  {
    orderId: 'b2',
    poolId: 'CC-TUSD',
    trader: 'dan',
    side: 'Buy',
    quantity: 12,
    limitPrice: 2.3,
    minFill: 1,
    expiresAt: null,
    submittedAt: now - 2000,
  },
]

export const seedTrades = (now: number): Trade[] => [
  {
    tradeId: 't1',
    poolId: 'CC-TUSD',
    price: 2.5,
    quantity: 5,
    buyer: 'dan',
    seller: 'bob',
    settledAt: now - 60000,
  },
  {
    tradeId: 't2',
    poolId: 'CC-TUSD',
    price: 2.55,
    quantity: 8,
    buyer: 'bob',
    seller: 'carol',
    settledAt: now - 120000,
  },
]
