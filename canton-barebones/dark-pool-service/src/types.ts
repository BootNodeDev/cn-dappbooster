// Contract shapes (mirroring the on-ledger templates) and the API DTOs the
// frontend's DarkPoolClient consumes. Decimals travel as strings end to end.

export type Side = 'Buy' | 'Sell'

export interface InstrumentId {
  admin: string
  id: string
}

export interface Pool {
  poolId: string
  base: InstrumentId
  quote: InstrumentId
  minFillFloor: string
}

// On-ledger Order plus ACS metadata. createdOffset is the price-time key
// (the Order template carries no timestamp).
export interface OrderContract {
  contractId: string
  createdOffset: number
  trader: string
  venue: string
  poolId: string
  base: InstrumentId
  quote: InstrumentId
  side: Side
  quantity: string
  limitPrice: string
  minFill: string
  expiresAt: number | null
  holdingCids: string[]
}

export interface Holding {
  contractId: string
  owner: string
  instrument: InstrumentId
  amount: string
}

export interface MatchPlan {
  poolId: string
  buyOrderCid: string
  sellOrderCid: string
  fillQty: string
}

export interface Trade {
  tradeId: string
  poolId: string
  price: string
  quantity: string
  buyer: string
  seller: string
  settledAt: number
}

// --- API DTOs (frontend-facing) ---

export interface OrderDto {
  cid: string
  poolId: string
  side: Side
  quantity: string
  limitPrice: string
  minFill: string
  submittedAt: number
  expiresAt: number | null
}

export interface FillDto {
  tradeId: string
  poolId: string
  side: Side
  price: string
  quantity: string
  settledAt: number
}

export interface Balance {
  instrument: InstrumentId
  total: string
  declared: string
}
