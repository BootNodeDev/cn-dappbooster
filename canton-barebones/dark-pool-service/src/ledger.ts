// JSON Ledger API v2 client (Canton 3.4). Bearer token on every call;
// LEDGER_EFFECTS shape so exercise results and archives are visible.
import type { TokenProvider } from './auth.ts'

export interface ActiveContract {
  contractId: string
  templateId: string
  createArgument: Record<string, unknown>
  createdOffset: number
}

export interface TxEvent {
  CreatedEvent?: {
    contractId: string
    templateId: string
    createArgument: Record<string, unknown>
    offset: number
  }
  ExercisedEvent?: { choice: string; contractId: string; exerciseResult: unknown }
  ArchivedEvent?: { contractId: string; templateId: string }
}

export interface Transaction {
  offset: number
  events: TxEvent[]
}

export interface SubmitOpts {
  readAs?: string[]
  disclosed?: object[]
}

export interface Ledger {
  ledgerEnd: () => Promise<number>
  activeContracts: (readAs: string, templateId: string) => Promise<ActiveContract[]>
  submit: (actAs: string, commands: object[], opts?: SubmitOpts) => Promise<TxEvent[]>
  updatesFrom: (
    readAs: string,
    beginExclusive: number,
    endInclusive: number,
  ) => Promise<Transaction[]>
}

export const createdCid = (events: TxEvent[], templateSuffix: string): string => {
  const created = events.find((event) => event.CreatedEvent?.templateId.endsWith(templateSuffix))
  if (created?.CreatedEvent === undefined) {
    throw new Error(`no CreatedEvent matching ${templateSuffix}`)
  }
  return created.CreatedEvent.contractId
}

export const exerciseResult = (events: TxEvent[], choice: string): unknown => {
  const exercised = events.find((event) => event.ExercisedEvent?.choice === choice)
  if (exercised?.ExercisedEvent === undefined) {
    throw new Error(`no ExercisedEvent for ${choice}`)
  }
  return exercised.ExercisedEvent.exerciseResult
}

const wildcardFilter = { identifierFilter: { WildcardFilter: { includeCreatedEventBlob: false } } }
const templateFilter = (templateId: string) => ({
  identifierFilter: { TemplateFilter: { templateId, includeCreatedEventBlob: false } },
})

const filtersByParty = (parties: string[], filter: object): Record<string, object> =>
  Object.fromEntries(parties.map((party) => [party, { cumulative: [filter] }]))

export const createHttpLedger = (jsonApiUrl: string, tokens: TokenProvider): Ledger => {
  const call = async (method: string, path: string, body?: object): Promise<unknown> => {
    const token = await tokens.getToken()
    const response = await fetch(`${jsonApiUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    if (!response.ok) {
      throw new Error(`${method} ${path} -> ${response.status}: ${text}`)
    }
    return text.length ? JSON.parse(text) : {}
  }

  const ledgerEnd = async (): Promise<number> => {
    const result = (await call('GET', '/v2/state/ledger-end')) as { offset: number }
    return result.offset
  }

  return {
    ledgerEnd,

    activeContracts: async (readAs, templateId) => {
      const activeAtOffset = await ledgerEnd()
      const result = (await call('POST', '/v2/state/active-contracts', {
        activeAtOffset,
        eventFormat: {
          filtersByParty: filtersByParty([readAs], templateFilter(templateId)),
          verbose: true,
        },
      })) as { contractEntry?: { JsActiveContract?: { createdEvent: ActiveContractEvent } } }[]
      return result
        .map((entry) => entry.contractEntry?.JsActiveContract?.createdEvent)
        .filter((event): event is ActiveContractEvent => event !== undefined)
        .map((event) => ({
          contractId: event.contractId,
          templateId: event.templateId,
          createArgument: event.createArgument,
          createdOffset: event.offset,
        }))
    },

    submit: async (actAs, commands, opts = {}) => {
      const parties = [actAs, ...(opts.readAs ?? [])]
      const commandId = `dps-${actAs.slice(0, 16)}-${commands.length}`
      const result = (await call('POST', '/v2/commands/submit-and-wait-for-transaction', {
        commands: {
          commandId,
          actAs: [actAs],
          readAs: opts.readAs ?? [],
          userId: '',
          commands,
          ...(opts.disclosed ? { disclosedContracts: opts.disclosed } : {}),
        },
        transactionFormat: {
          eventFormat: { filtersByParty: filtersByParty(parties, wildcardFilter), verbose: true },
          transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
        },
      })) as { transaction: { events: TxEvent[] } }
      return result.transaction.events
    },

    updatesFrom: async (readAs, beginExclusive, endInclusive) => {
      const result = (await call('POST', '/v2/updates', {
        beginExclusive,
        endInclusive,
        updateFormat: {
          includeTransactions: {
            eventFormat: {
              filtersByParty: filtersByParty([readAs], wildcardFilter),
              verbose: true,
            },
            transactionShape: 'TRANSACTION_SHAPE_LEDGER_EFFECTS',
          },
        },
      })) as { update?: { Transaction?: { offset: number; events: TxEvent[] } } }[]
      return result
        .map((item) => item.update?.Transaction)
        .filter((tx): tx is Transaction => tx !== undefined)
    },
  }
}

type ActiveContractEvent = {
  contractId: string
  templateId: string
  createArgument: Record<string, unknown>
  offset: number
}
