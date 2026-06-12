// JSON-Ledger-API v2 shared infra: explicit-disclosure shaping + curve encode/decode.
// No I/O — unit-tested in commands.test.ts.

import type { VestingSchedule } from '@/lib/schedule'

export type DisclosedRef = {
  contractId: string
  createdEventBlob: string
  synchronizerId?: string
}

type AcsRow = {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: { contractId?: string; createdEventBlob?: string }
      synchronizerId?: string
    }
  }
}

// Pull the disclosure payload out of a JSON-Ledger-API v2 active-contracts row
// (requires the read to set includeCreatedEventBlob: true).
export const extractCreatedEventBlob = (row: AcsRow): DisclosedRef | undefined => {
  const active = row.contractEntry?.JsActiveContract
  const event = active?.createdEvent
  if (event?.contractId === undefined || event.createdEventBlob === undefined) {
    return undefined
  }
  return {
    contractId: event.contractId,
    createdEventBlob: event.createdEventBlob,
    synchronizerId: active?.synchronizerId,
  }
}

export const buildDisclosedContract = (templateId: string, ref: DisclosedRef) => ({
  templateId,
  contractId: ref.contractId,
  createdEventBlob: ref.createdEventBlob,
  ...(ref.synchronizerId === undefined ? {} : { synchronizerId: ref.synchronizerId }),
})

// ── Curve variant encoding ────────────────────────────────────────────────────
// Daml JSON Ledger API v2 encodes a DAML variant as
// `{ "tag": "<Constructor>", "value": <fields-record> }`, a tuple `(Time, Decimal)`
// as a record `{ "_1": <time>, "_2": <decimal> }`, Time as an ISO-8601 string, and
// Decimal as a string.
// VERIFY: curve encoding to be round-trip-confirmed in smoke tests.

type EncodedCurve =
  | { tag: 'LinearVesting'; value: { start: string; end: string } }
  | { tag: 'MilestoneVesting'; value: { points: { _1: string; _2: string }[] } }

export type EncodedSchedule = { curve: EncodedCurve; cliff: string }

export const encodeSchedule = (schedule: VestingSchedule): EncodedSchedule => {
  const curve = schedule.curve
  if (curve.kind === 'linear') {
    return {
      curve: { tag: 'LinearVesting', value: { start: curve.start, end: curve.end } },
      cliff: schedule.cliff,
    }
  }
  return {
    curve: {
      tag: 'MilestoneVesting',
      value: {
        points: curve.points.map((point) => ({ _1: point.time, _2: String(point.fraction) })),
      },
    },
    cliff: schedule.cliff,
  }
}

// Mirror of encodeSchedule: parse the JSON-LF variant back into the UI's
// VestingSchedule. Tolerant of a missing/garbled payload (returns a degenerate
// but well-typed schedule rather than throwing inside a mapper).
export const decodeSchedule = (raw: unknown): VestingSchedule => {
  const record = (raw ?? {}) as { curve?: unknown; cliff?: unknown }
  const cliff = typeof record.cliff === 'string' ? record.cliff : ''
  const curve = (record.curve ?? {}) as { tag?: unknown; value?: unknown }
  if (curve.tag === 'MilestoneVesting') {
    const value = (curve.value ?? {}) as { points?: unknown }
    const points = Array.isArray(value.points) ? value.points : []
    return {
      cliff,
      curve: {
        kind: 'milestone',
        points: points.map((point) => {
          const tuple = (point ?? {}) as { _1?: unknown; _2?: unknown }
          return { time: String(tuple._1 ?? ''), fraction: Number(tuple._2 ?? 0) }
        }),
      },
    }
  }
  const value = (curve.value ?? {}) as { start?: unknown; end?: unknown }
  return {
    cliff,
    curve: {
      kind: 'linear',
      start: typeof value.start === 'string' ? value.start : '',
      end: typeof value.end === 'string' ? value.end : '',
    },
  }
}
