// Pure JSON command builders for the Ledger API v2. Field names mirror the Daml
// choice records exactly. Each returns a tagged {CreateCommand|ExerciseCommand}.
import type { Side } from './types.ts'

const DARK_POOL_TID = '#dark-pool:DarkPool:DarkPool'
const ORDER_TID = '#dark-pool:DarkPool:Order'
const REGISTRY_RULES_TID = '#registry-token:RegistryToken:RegistryRules'

// Empty token-standard ExtraArgs; reconcile the exact JSON against
// splice-api-token-metadata-v1 at the first integration run.
const emptyExtraArgs = { context: { values: [] }, meta: { values: [] } }

export interface ExerciseCommand {
  ExerciseCommand: {
    templateId: string
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

export interface PlaceOrderArgs {
  poolCid: string
  trader: string
  side: Side
  quantity: string
  limitPrice: string
  minFill: string
  expiresAt: string | null
  holdingCids: string[]
}

export const placeOrder = (args: PlaceOrderArgs): ExerciseCommand => ({
  ExerciseCommand: {
    templateId: DARK_POOL_TID,
    contractId: args.poolCid,
    choice: 'DarkPool_PlaceOrder',
    choiceArgument: {
      trader: args.trader,
      side: args.side,
      quantity: args.quantity,
      limitPrice: args.limitPrice,
      minFill: args.minFill,
      expiresAt: args.expiresAt,
      holdingCids: args.holdingCids,
    },
  },
})

export const cancelOrder = (orderCid: string): ExerciseCommand => ({
  ExerciseCommand: {
    templateId: ORDER_TID,
    contractId: orderCid,
    choice: 'Order_Cancel',
    choiceArgument: {},
  },
})

export const rejectOrder = (orderCid: string): ExerciseCommand => ({
  ExerciseCommand: {
    templateId: ORDER_TID,
    contractId: orderCid,
    choice: 'Order_Reject',
    choiceArgument: {},
  },
})

export interface MatchArgs {
  poolCid: string
  buyOrderCid: string
  sellOrderCid: string
  matchId: string
  factoryCid: string
  requestedAt: string
  allocateBefore: string
  settleBefore: string
}

export const match = (args: MatchArgs): ExerciseCommand => {
  const funding = { allocationFactoryCid: args.factoryCid, allocateArgs: emptyExtraArgs }
  return {
    ExerciseCommand: {
      templateId: DARK_POOL_TID,
      contractId: args.poolCid,
      choice: 'DarkPool_Match',
      choiceArgument: {
        buyOrderCid: args.buyOrderCid,
        sellOrderCid: args.sellOrderCid,
        matchId: args.matchId,
        requestedAt: args.requestedAt,
        allocateBefore: args.allocateBefore,
        settleBefore: args.settleBefore,
        buyFunding: funding,
        sellFunding: funding,
        buyExecuteArgs: emptyExtraArgs,
        sellExecuteArgs: emptyExtraArgs,
      },
    },
  }
}

export interface MintArgs {
  factoryCid: string
  symbol: string
  to: string
  amount: string
}

export const mint = (args: MintArgs): ExerciseCommand => ({
  ExerciseCommand: {
    templateId: REGISTRY_RULES_TID,
    contractId: args.factoryCid,
    choice: 'Mint',
    choiceArgument: { symbol: args.symbol, to: args.to, amount: args.amount },
  },
})
