import type { Balance, Order, Pool, Trade } from './types'

export const COUNTERPARTIES = ['bob', 'carol', 'dan'] as const

export const POOLS: Pool[] = [
  {
    poolId: 'cBTC-USDCx',
    base: { admin: 'reg', id: 'cBTC' },
    quote: { admin: 'reg', id: 'USDCx' },
    baseLabel: 'cBTC',
    quoteLabel: 'USDCx',
    minFillFloor: 0.01,
  },
  {
    poolId: 'ETH-USDCx',
    base: { admin: 'reg', id: 'ETH' },
    quote: { admin: 'reg', id: 'USDCx' },
    baseLabel: 'ETH',
    quoteLabel: 'USDCx',
    minFillFloor: 0.1,
  },
]

export const POOL_MIDS: Record<string, number> = { 'cBTC-USDCx': 49750, 'ETH-USDCx': 3120 }

export const seedBalances = (): Balance[] => [
  { instrument: POOLS[0].base, label: 'cBTC', total: 9.5, declared: 0 },
  { instrument: POOLS[0].quote, label: 'USDCx', total: 478650, declared: 0 },
  { instrument: POOLS[1].base, label: 'ETH', total: 40, declared: 0 },
]

export const seedOrders = (now: number): Order[] => [
  {
    orderId: 's1',
    poolId: 'cBTC-USDCx',
    trader: 'carol',
    side: 'Sell',
    quantity: 0.45,
    limitPrice: 49900,
    minFill: 0.1,
    expiresAt: null,
    submittedAt: now - 9000,
  },
  {
    orderId: 's2',
    poolId: 'cBTC-USDCx',
    trader: 'bob',
    side: 'Sell',
    quantity: 0.15,
    limitPrice: 50100,
    minFill: 0.05,
    expiresAt: null,
    submittedAt: now - 6000,
  },
  {
    orderId: 'b1',
    poolId: 'cBTC-USDCx',
    trader: 'bob',
    side: 'Buy',
    quantity: 0.25,
    limitPrice: 49800,
    minFill: 0.05,
    expiresAt: null,
    submittedAt: now - 4000,
  },
  {
    orderId: 'b2',
    poolId: 'cBTC-USDCx',
    trader: 'dan',
    side: 'Buy',
    quantity: 0.6,
    limitPrice: 49600,
    minFill: 0.1,
    expiresAt: null,
    submittedAt: now - 2000,
  },
]

export const seedTrades = (now: number): Trade[] => [
  {
    tradeId: 't1',
    poolId: 'cBTC-USDCx',
    price: 49500,
    quantity: 0.3,
    buyer: 'alice',
    seller: 'bob',
    settledAt: now - 60000,
  },
  {
    tradeId: 't2',
    poolId: 'cBTC-USDCx',
    price: 49650,
    quantity: 0.4,
    buyer: 'dan',
    seller: 'carol',
    settledAt: now - 120000,
  },
]
