export const TALLY_PACKAGE_ID = '3abfebd483c1b2c67a79dc3ba091c4cb548b7dc8a263c0beb80c775d91c0e336'
export const TALLY_TEMPLATE_ID = '#quickstart-tally:Tally.Tally:Tally'
export const TALLY_WRITER_TEMPLATE_ID = '#quickstart-tally:Tally.Tally:TallyWriter'

export interface TallyContract {
  contractId: string
  issuer: string
  value: number
  writers: Array<[string, string]>
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
    ? (value as JsonRecord)
    : undefined

const recordArgument = (value: unknown): JsonRecord | undefined => {
  const raw = asRecord(value)
  if (raw === undefined) {
    return undefined
  }
  if (!Array.isArray(raw.fields)) {
    return raw
  }
  return Object.fromEntries(
    raw.fields.flatMap((field) => {
      const row = asRecord(field)
      return typeof row?.label === 'string' ? [[row.label, row.value]] : []
    }),
  )
}

const mapEntries = (value: unknown): unknown[] => {
  if (Array.isArray(value)) {
    return value
  }
  const row = asRecord(value)
  if (Array.isArray(row?.map)) {
    return row.map.flatMap((entry) => {
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

// Unwrap the participant-native /v2/state/active-contracts envelope:
//   { workflowId, contractEntry: { JsActiveContract: { createdEvent: {...} } } }
// Returns undefined for non-active variants (JsIncompleteAssigned,
// JsIncompleteUnassigned) — transient reassignment states we don't surface.
const unwrapActiveContract = (row: JsonRecord): RawContract | undefined => {
  const entry = asRecord(row.contractEntry)
  if (entry === undefined) {
    return undefined
  }
  const active = asRecord(entry.JsActiveContract)
  if (active === undefined) {
    return undefined
  }
  const event = asRecord(active.createdEvent)
  return event as RawContract | undefined
}

export const normalizeTallyContract = (raw: unknown): TallyContract | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined
  }
  const row = unwrapActiveContract(raw as JsonRecord)
  if (row === undefined) {
    return undefined
  }
  const args = recordArgument(row.createArgument)
  if (typeof row.contractId !== 'string' || args === undefined) {
    return undefined
  }
  const valueRaw = args.value
  const writers = mapEntries(args.writers).flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === 'string' && typeof entry[1] === 'string'
      ? [[entry[0], entry[1]] as [string, string]]
      : [],
  )
  const viewers = mapEntries(args.viewers).flatMap((entry) =>
    Array.isArray(entry) && typeof entry[0] === 'string' ? [entry[0]] : [],
  )
  return {
    contractId: row.contractId,
    issuer: typeof args.issuer === 'string' ? args.issuer : '',
    value:
      typeof valueRaw === 'string' ? Number(valueRaw) : typeof valueRaw === 'number' ? valueRaw : 0,
    writers,
    viewers,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : undefined,
  }
}

// --- Pure UI logic (unit-tested; rendered by LoyaltyCard) ---

export interface StampStats {
  filled: number
  rewards: number
}

// A fixed 10-slot punch card over an unbounded value: `filled` slots on the
// current card (0–9), `rewards` completed cards earned so far.
export const stampStats = (value: number): StampStats => ({
  filled: ((value % 10) + 10) % 10,
  rewards: Math.max(0, Math.floor(value / 10)),
})

export const canStamp = (tally: TallyContract, partyId: string): boolean =>
  tally.issuer === partyId || tally.writers.some(([party]) => party === partyId)

// --- Command builders ---

export const createTallyCommand = (partyId: string): unknown => ({
  CreateCommand: {
    templateId: TALLY_TEMPLATE_ID,
    createArguments: {
      issuer: partyId,
      value: '0',
      writers: [],
      viewers: { map: [] },
    },
  },
})

export const addStampCommand = (tally: TallyContract, partyId: string): unknown => {
  const delegation = tally.writers.find(([party]) => party === partyId)?.[1]
  if (tally.issuer !== partyId && delegation !== undefined) {
    return {
      ExerciseCommand: {
        templateId: TALLY_WRITER_TEMPLATE_ID,
        contractId: delegation,
        choice: 'TallyWriter_Increment',
        choiceArgument: { tallyId: tally.contractId },
      },
    }
  }
  return {
    ExerciseCommand: {
      templateId: TALLY_TEMPLATE_ID,
      contractId: tally.contractId,
      choice: 'Tally_Increment',
      choiceArgument: {},
    },
  }
}

export const grantWriterCommand = (tally: TallyContract, newWriter: string): unknown => ({
  ExerciseCommand: {
    templateId: TALLY_TEMPLATE_ID,
    contractId: tally.contractId,
    choice: 'Tally_GrantWriter',
    choiceArgument: { newWriter },
  },
})

export const grantViewerCommand = (tally: TallyContract, newViewer: string): unknown => ({
  ExerciseCommand: {
    templateId: TALLY_TEMPLATE_ID,
    contractId: tally.contractId,
    choice: 'Tally_GrantViewer',
    choiceArgument: { newViewer },
  },
})
