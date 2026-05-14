export const COUNTER_PACKAGE_ID = 'b2e6c414cdb2341b2ae1167fdce0930291fec5ab4794fea436821109df54db99'
export const COUNTER_TEMPLATE_ID = '#quickstart-counter:Counter.Counter:Counter'
export const COUNTER_INCREMENTOR_TEMPLATE_ID = '#quickstart-counter:Counter.Counter:CounterIncrementor'

export interface CounterContract {
  contractId: string
  issuer: string
  count: number
  incrementors: Array<[string, string]>
  viewers: string[]
  createdAt?: string
}

type JsonRecord = Record<string, unknown>

interface RawContract {
  contractId?: unknown
  createArgument?: JsonRecord
  createdAt?: unknown
}

const asRecord = (value: unknown): JsonRecord | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : undefined

const recordArgument = (value: unknown): JsonRecord | undefined => {
  const raw = asRecord(value)
  if (raw === undefined) {
    return undefined
  }
  if (!Array.isArray(raw.fields)) {
    return raw
  }
  return Object.fromEntries(raw.fields.flatMap(field => {
    const row = asRecord(field)
    return typeof row?.label === 'string'
      ? [[row.label, row.value]]
      : []
  }))
}

const mapEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }
  const row = asRecord(value)
  if (Array.isArray(row?.map)) {
    return row.map.flatMap(entry => {
      if (Array.isArray(entry)) {
        return [entry]
      }
      const mapped = asRecord(entry)
      return mapped !== undefined && 'key' in mapped && 'value' in mapped
        ? [[mapped.key, mapped.value]]
        : []
    })
  }
  return []
}

export const normalizeCounterContract = (raw: unknown): CounterContract | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined
  }
  const row = raw as RawContract
  const args = recordArgument(row.createArgument)
  if (typeof row.contractId !== 'string' || args === undefined) {
    return undefined
  }
  const countRaw = args.count
  const incrementors = mapEntries(args.incrementors).flatMap(entry =>
    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string'
      ? [[entry[0], entry[1]] as [string, string]]
      : []
  )
  const viewers = mapEntries(args.viewers).flatMap(entry =>
    Array.isArray(entry) && typeof entry[0] === 'string' ? [entry[0]] : []
  )
  return {
    contractId: row.contractId,
    issuer: typeof args.issuer === 'string' ? args.issuer : '',
    count: typeof countRaw === 'string' ? Number(countRaw) : typeof countRaw === 'number' ? countRaw : 0,
    incrementors,
    viewers,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined
  }
}

export const createCounterCommand = (partyId: string): unknown => ({
  CreateCommand: {
    templateId: COUNTER_TEMPLATE_ID,
    createArguments: {
      issuer: partyId,
      count: '0',
      incrementors: [],
      viewers: { map: [] }
    }
  }
})

export const incrementCounterCommand = (counter: CounterContract, partyId: string): unknown => {
  const delegation = counter.incrementors.find(([party]) => party === partyId)?.[1]
  if (counter.issuer !== partyId && delegation !== undefined) {
    return {
      ExerciseCommand: {
        templateId: COUNTER_INCREMENTOR_TEMPLATE_ID,
        contractId: delegation,
        choice: 'CounterIncrementor_Increment',
        choiceArgument: { counterId: counter.contractId }
      }
    }
  }
  return {
    ExerciseCommand: {
      templateId: COUNTER_TEMPLATE_ID,
      contractId: counter.contractId,
      choice: 'Counter_Increment',
      choiceArgument: {}
    }
  }
}

export const addUserCommand = (counter: CounterContract, newUser: string): unknown => ({
  ExerciseCommand: {
    templateId: COUNTER_TEMPLATE_ID,
    contractId: counter.contractId,
    choice: 'Counter_AddUser',
    choiceArgument: { newUser }
  }
})

export const addViewerCommand = (counter: CounterContract, newViewer: string): unknown => ({
  ExerciseCommand: {
    templateId: COUNTER_TEMPLATE_ID,
    contractId: counter.contractId,
    choice: 'Counter_AddViewer',
    choiceArgument: { newViewer }
  }
})
