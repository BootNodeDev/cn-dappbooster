import type { CounterContract } from './counterSignature.js'

export const short = (value: string): string =>
  value.length <= 22 ? value : `${value.slice(0, 12)}...${value.slice(-8)}`

export const commandId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`

export const canIncrement = (counter: CounterContract, partyId: string): boolean =>
  counter.issuer === partyId || counter.incrementors.some(([party]) => party === partyId)
