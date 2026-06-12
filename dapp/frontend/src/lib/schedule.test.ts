import { describe, expect, it } from 'vitest'
import {
  canClaim,
  floorOk,
  MIN_GRANT_AMOUNT,
  nextMilestone,
  remainderAfter,
  type VestingSchedule,
  validVestingSchedule,
  vestedAmount,
  vestedFraction,
} from './schedule'

const ms = (iso: string): number => new Date(iso).getTime()

const linear: VestingSchedule = {
  cliff: '2025-06-01T00:00:00Z',
  curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
}

const milestone: VestingSchedule = {
  cliff: '2025-02-01T00:00:00Z',
  curve: {
    kind: 'milestone',
    points: [
      { time: '2025-02-01T00:00:00Z', fraction: 0.25 },
      { time: '2025-06-01T00:00:00Z', fraction: 0.6 },
      { time: '2025-12-01T00:00:00Z', fraction: 1.0 },
    ],
  },
}

describe('vestedFraction', () => {
  it('is 0 before the cliff even if the curve has started', () => {
    expect(vestedFraction(linear, ms('2025-03-01T00:00:00Z'))).toBe(0)
  })

  it('interpolates linearly after the cliff', () => {
    // The window is 365 days; vesting is ms-based, so fractions follow day counts.
    // 2025-06-01 is 151 days in, 2025-07-01 is 181 days in.
    expect(vestedFraction(linear, ms('2025-06-01T00:00:00Z'))).toBeCloseTo(151 / 365, 4)
    expect(vestedFraction(linear, ms('2025-07-01T00:00:00Z'))).toBeCloseTo(181 / 365, 4)
  })

  it('clamps to 1 after end', () => {
    expect(vestedFraction(linear, ms('2027-01-01T00:00:00Z'))).toBe(1)
  })

  it('steps to the last reached milestone fraction', () => {
    expect(vestedFraction(milestone, ms('2025-01-01T00:00:00Z'))).toBe(0)
    expect(vestedFraction(milestone, ms('2025-03-01T00:00:00Z'))).toBe(0.25)
    expect(vestedFraction(milestone, ms('2025-07-01T00:00:00Z'))).toBe(0.6)
    expect(vestedFraction(milestone, ms('2026-01-01T00:00:00Z'))).toBe(1)
  })
})

describe('vestedAmount', () => {
  it('scales the fraction by the total', () => {
    expect(vestedAmount(linear, 120_000, ms('2025-07-01T00:00:00Z'))).toBeCloseTo(
      (120_000 * 181) / 365,
      2,
    )
  })
})

describe('validVestingSchedule', () => {
  it('accepts a well-formed linear schedule', () => {
    expect(validVestingSchedule(linear)).toBe(true)
  })

  it('accepts a well-formed milestone schedule', () => {
    expect(validVestingSchedule(milestone)).toBe(true)
  })

  it('rejects a cliff outside the linear window', () => {
    expect(
      validVestingSchedule({
        cliff: '2027-01-01T00:00:00Z',
        curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
      }),
    ).toBe(false)
  })

  it('rejects milestones that do not end at 1', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-02-01T00:00:00Z',
        curve: {
          kind: 'milestone',
          points: [
            { time: '2025-02-01T00:00:00Z', fraction: 0.25 },
            { time: '2025-06-01T00:00:00Z', fraction: 0.6 },
          ],
        },
      }),
    ).toBe(false)
  })

  it('rejects non-ascending milestone fractions', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-02-01T00:00:00Z',
        curve: {
          kind: 'milestone',
          points: [
            { time: '2025-02-01T00:00:00Z', fraction: 0.6 },
            { time: '2025-06-01T00:00:00Z', fraction: 0.4 },
            { time: '2025-12-01T00:00:00Z', fraction: 1.0 },
          ],
        },
      }),
    ).toBe(false)
  })

  it('rejects a zero-duration linear window (start === end)', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-01-01T00:00:00Z',
        curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2025-01-01T00:00:00Z' },
      }),
    ).toBe(false)
  })

  it('rejects a cliff before the linear start', () => {
    expect(
      validVestingSchedule({
        cliff: '2024-12-01T00:00:00Z',
        curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
      }),
    ).toBe(false)
  })

  it('rejects NaN dates', () => {
    expect(
      validVestingSchedule({
        cliff: 'not-a-date',
        curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
      }),
    ).toBe(false)
  })

  it('rejects an empty milestone list', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-01-01T00:00:00Z',
        curve: { kind: 'milestone', points: [] },
      }),
    ).toBe(false)
  })

  it('accepts a single milestone point at fraction 1', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-01-01T00:00:00Z',
        curve: { kind: 'milestone', points: [{ time: '2025-06-01T00:00:00Z', fraction: 1.0 }] },
      }),
    ).toBe(true)
  })

  it('rejects a cliff after the first milestone', () => {
    expect(
      validVestingSchedule({
        cliff: '2025-07-01T00:00:00Z',
        curve: {
          kind: 'milestone',
          points: [
            { time: '2025-02-01T00:00:00Z', fraction: 0.5 },
            { time: '2025-12-01T00:00:00Z', fraction: 1.0 },
          ],
        },
      }),
    ).toBe(false)
  })
})

describe('vestedFraction cliff boundary', () => {
  // cliff (2025-06-01) sits after start (2025-01-01): a true cliff that jumps
  // straight to the accrued-up-to-cliff fraction the instant it passes.
  it('is 0 one second before the cliff', () => {
    expect(vestedFraction(linear, ms('2025-06-01T00:00:00Z') - 1000)).toBe(0)
  })

  it('jumps to the accrued fraction exactly at the cliff', () => {
    expect(vestedFraction(linear, ms('2025-06-01T00:00:00Z'))).toBeCloseTo(151 / 365, 4)
  })
})

describe('nextMilestone', () => {
  it('returns the first future point', () => {
    const next = nextMilestone(milestone, ms('2025-03-01T00:00:00Z'))
    expect(next?.time).toBe('2025-06-01T00:00:00Z')
  })

  it('is undefined once every point is past', () => {
    expect(nextMilestone(milestone, ms('2026-06-01T00:00:00Z'))).toBeUndefined()
  })

  it('is undefined for a linear curve', () => {
    expect(nextMilestone(linear, ms('2025-03-01T00:00:00Z'))).toBeUndefined()
  })
})

describe('MIN_GRANT_AMOUNT', () => {
  it('matches the on-ledger floor', () => {
    expect(MIN_GRANT_AMOUNT).toBe(1.0)
  })
})

describe('remainderAfter', () => {
  it('is the locked backing plus the unclaimed vested slice', () => {
    expect(remainderAfter(50, 100, 20)).toBe(70)
  })

  it('is just the locked backing when the claimable is fully drained', () => {
    expect(remainderAfter(100, 100, 20)).toBe(20)
  })

  it('is zero when nothing stays locked and the claimable is fully drained', () => {
    expect(remainderAfter(100, 100, 0)).toBe(0)
  })

  it('never goes negative when amount exceeds available', () => {
    expect(remainderAfter(120, 100, 0)).toBe(0)
  })
})

describe('floorOk', () => {
  it('accepts an exactly-drained remainder', () => {
    expect(floorOk(0)).toBe(true)
  })

  it('rejects a remainder between zero and the floor', () => {
    expect(floorOk(0.5)).toBe(false)
  })

  it('accepts a remainder at or above the floor', () => {
    expect(floorOk(1)).toBe(true)
    expect(floorOk(5)).toBe(true)
  })
})

describe('canClaim', () => {
  it('allows a normal partial claim', () => {
    expect(canClaim(50, 50)).toBe(true)
  })

  it('allows draining sub-floor dust when the grant is fully vested', () => {
    // claimable < MIN but nothing stays locked → a full drain leaves remainder 0.
    expect(canClaim(0.5, 0)).toBe(true)
  })

  it('allows a sub-floor claim while vesting if the backing clears the floor', () => {
    // withdraw a slice, leaving locked 5 (>= floor).
    expect(canClaim(0.5, 5)).toBe(true)
  })

  it('blocks when the whole backing is below the floor and still vesting', () => {
    // any withdraw leaves 0 < remainder < MIN, which the contract rejects.
    expect(canClaim(0.5, 0.3)).toBe(false)
  })

  it('blocks when there is nothing claimable', () => {
    expect(canClaim(0, 100)).toBe(false)
  })
})
