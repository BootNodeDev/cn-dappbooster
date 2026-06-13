// In-memory ledger that interprets the command builders, so the whole service
// (faucet → place → match → settle) runs with no Canton. It conserves balances
// the way the registry contract does: a transfer archives the sender's holdings,
// returns change, and credits the receiver. For development and tests only.
import type { BootstrapConfig } from './config.ts'
import { type Dec, fillQuantity, midpointPrice, parseDec, quoteAmount, toDec } from './decimal.ts'
import type { ActiveContract, Ledger, Transaction, TxEvent } from './ledger.ts'

const POOL_TID = '#dark-pool:DarkPool:DarkPool'
const ORDER_TID = '#dark-pool:DarkPool:Order'
const HOLDING_TID = '#registry-token:RegistryToken:RegistryHolding'

type Stored = {
  contractId: string
  templateId: string
  createArgument: Record<string, unknown>
  createdOffset: number
  archived: boolean
}

type Command = {
  CreateCommand?: { templateId: string; createArguments: Record<string, unknown> }
  ExerciseCommand?: {
    templateId: string
    contractId: string
    choice: string
    choiceArgument: Record<string, unknown>
  }
}

const str = (record: Record<string, unknown>, key: string): string => String(record[key])

const byHoldingAmountDesc = (a: Stored, b: Stored): number => {
  const amountA = parseDec(str(a.createArgument, 'amount'))
  const amountB = parseDec(str(b.createArgument, 'amount'))
  if (amountA > amountB) {
    return -1
  }
  if (amountA < amountB) {
    return 1
  }
  return 0
}

export const createMockLedger = (config: BootstrapConfig): Ledger => {
  const store = new Map<string, Stored>()
  const txLog: Transaction[] = []
  const admin = config.parties.admin
  let offset = 0
  let cidSeq = 0

  const create = (templateId: string, createArgument: Record<string, unknown>): TxEvent => {
    offset += 1
    cidSeq += 1
    const contractId = `${templateId.split(':').pop()}-${cidSeq}`
    store.set(contractId, {
      contractId,
      templateId,
      createArgument,
      createdOffset: offset,
      archived: false,
    })
    return { CreatedEvent: { contractId, templateId, createArgument, offset } }
  }

  const archive = (contractId: string): TxEvent => {
    const contract = store.get(contractId)
    if (contract === undefined) {
      throw new Error(`mock ledger: unknown contract ${contractId}`)
    }
    store.set(contractId, { ...contract, archived: true })
    return { ArchivedEvent: { contractId, templateId: contract.templateId } }
  }

  const activeHoldings = (owner: string, symbol: string): Stored[] =>
    [...store.values()]
      .filter(
        (contract) =>
          !contract.archived &&
          contract.templateId === HOLDING_TID &&
          str(contract.createArgument, 'owner') === owner &&
          str(contract.createArgument, 'symbol') === symbol,
      )
      .sort(byHoldingAmountDesc)

  // Move `amount` of `symbol` from `from` to `to`, conserving value (fail-closed).
  const transfer = (symbol: string, from: string, to: string, amount: Dec): TxEvent[] => {
    const sources = activeHoldings(from, symbol)
    const total = sources.reduce(
      (sum, h) => sum + parseDec(str(h.createArgument, 'amount')),
      BigInt(0),
    )
    if (total < amount) {
      throw new Error(`mock ledger: ${from} cannot cover ${toDec(amount)} ${symbol}`)
    }
    const archives = sources.map((source) => archive(source.contractId))
    const change = total - amount
    const changeEvent =
      change > BigInt(0)
        ? [create(HOLDING_TID, { admin, owner: from, symbol, amount: toDec(change) })]
        : []
    return [
      ...archives,
      ...changeEvent,
      create(HOLDING_TID, { admin, owner: to, symbol, amount: toDec(amount) }),
    ]
  }

  const placeOrder = (poolCid: string, args: Record<string, unknown>): TxEvent[] => {
    const pool = store.get(poolCid)
    if (pool === undefined) {
      throw new Error(`mock ledger: unknown pool ${poolCid}`)
    }
    const created = create(ORDER_TID, {
      trader: str(args, 'trader'),
      venue: pool.createArgument.venue,
      poolId: pool.createArgument.poolId,
      base: pool.createArgument.base,
      quote: pool.createArgument.quote,
      side: str(args, 'side'),
      quantity: str(args, 'quantity'),
      limitPrice: str(args, 'limitPrice'),
      minFill: str(args, 'minFill'),
      expiresAt: args.expiresAt ?? null,
      holdingCids: args.holdingCids ?? [],
    })
    return [
      created,
      {
        ExercisedEvent: {
          choice: 'DarkPool_PlaceOrder',
          contractId: poolCid,
          exerciseResult: created.CreatedEvent?.contractId,
        },
      },
    ]
  }

  const settleMatch = (poolCid: string, args: Record<string, unknown>): TxEvent[] => {
    const pool = store.get(poolCid)
    const buy = store.get(str(args, 'buyOrderCid'))
    const sell = store.get(str(args, 'sellOrderCid'))
    if (pool === undefined || buy === undefined || sell === undefined) {
      throw new Error('mock ledger: match references unknown contracts')
    }
    const baseSymbol = (pool.createArgument.base as { id: string }).id
    const quoteSymbol = (pool.createArgument.quote as { id: string }).id
    const execPrice = midpointPrice(
      parseDec(str(buy.createArgument, 'limitPrice')),
      parseDec(str(sell.createArgument, 'limitPrice')),
    )
    const fill = fillQuantity(
      parseDec(str(buy.createArgument, 'quantity')),
      parseDec(str(sell.createArgument, 'quantity')),
    )
    const quoteOwed = quoteAmount(fill, execPrice)

    const archived = [archive(buy.contractId), archive(sell.contractId)]
    const baseLeg = transfer(
      baseSymbol,
      str(sell.createArgument, 'trader'),
      str(buy.createArgument, 'trader'),
      fill,
    )
    const quoteLeg = transfer(
      quoteSymbol,
      str(buy.createArgument, 'trader'),
      str(sell.createArgument, 'trader'),
      quoteOwed,
    )
    const result = {
      execPrice: toDec(execPrice),
      fillQty: toDec(fill),
      buyRemainderCid: null,
      sellRemainderCid: null,
    }
    return [
      ...archived,
      ...baseLeg,
      ...quoteLeg,
      { ExercisedEvent: { choice: 'DarkPool_Match', contractId: poolCid, exerciseResult: result } },
    ]
  }

  const mint = (args: Record<string, unknown>): TxEvent[] => {
    const created = create(HOLDING_TID, {
      admin,
      owner: str(args, 'to'),
      symbol: str(args, 'symbol'),
      amount: str(args, 'amount'),
    })
    return [
      created,
      {
        ExercisedEvent: {
          choice: 'Mint',
          contractId: config.factoryCid,
          exerciseResult: created.CreatedEvent?.contractId,
        },
      },
    ]
  }

  const interpret = (command: Command): TxEvent[] => {
    if (command.CreateCommand !== undefined) {
      return [create(command.CreateCommand.templateId, command.CreateCommand.createArguments)]
    }
    const exercise = command.ExerciseCommand
    if (exercise === undefined) {
      throw new Error('mock ledger: command is neither Create nor Exercise')
    }
    switch (exercise.choice) {
      case 'Mint':
        return mint(exercise.choiceArgument)
      case 'DarkPool_PlaceOrder':
        return placeOrder(exercise.contractId, exercise.choiceArgument)
      case 'DarkPool_Match':
        return settleMatch(exercise.contractId, exercise.choiceArgument)
      case 'Order_Cancel':
      case 'Order_Reject':
        return [
          archive(exercise.contractId),
          {
            ExercisedEvent: {
              choice: exercise.choice,
              contractId: exercise.contractId,
              exerciseResult: null,
            },
          },
        ]
      default:
        throw new Error(`mock ledger: unsupported choice ${exercise.choice}`)
    }
  }

  // Seed the pool under its configured cid so placeOrder/match can resolve it.
  offset += 1
  store.set(config.poolCid, {
    contractId: config.poolCid,
    templateId: POOL_TID,
    createArgument: {
      venue: config.parties.venue,
      poolId: config.poolId,
      base: config.instruments.base,
      quote: config.instruments.quote,
      minFillFloor: '1.0',
    },
    createdOffset: offset,
    archived: false,
  })

  return {
    ledgerEnd: async () => offset,
    activeContracts: async (_readAs, templateId) =>
      [...store.values()]
        .filter((contract) => !contract.archived && contract.templateId === templateId)
        .map(
          (contract): ActiveContract => ({
            contractId: contract.contractId,
            templateId: contract.templateId,
            createArgument: contract.createArgument,
            createdOffset: contract.createdOffset,
          }),
        ),
    submit: async (_actAs, commands) => {
      const events = (commands as Command[]).flatMap(interpret)
      txLog.push({ offset, events })
      return events
    },
    updatesFrom: async (_readAs, beginExclusive, endInclusive) =>
      txLog.filter((tx) => tx.offset > beginExclusive && tx.offset <= endInclusive),
  }
}
