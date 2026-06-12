import { describe, expect, it, vi } from 'vitest'
import type { VestingBackend } from '@/backend/VestingBackend'
import type { Grant } from './types'
import { deriveGrant, useVestingStore } from './useVestingStore'

const ms = (iso: string): number => new Date(iso).getTime()

// Linear grant: cliff after start, so it is locked until 2025-06-01.
const grant = (alreadyWithdrawn = 0, totalAmount = 1000): Grant => ({
  id: 'g1',
  title: 'Test grant',
  provider: 'p::1',
  creator: 'c::1',
  receiver: 'r::1',
  totalAmount,
  alreadyWithdrawn,
  schedule: {
    cliff: '2025-06-01T00:00:00Z',
    curve: { kind: 'linear', start: '2025-01-01T00:00:00Z', end: '2026-01-01T00:00:00Z' },
  },
})

describe('deriveGrant', () => {
  it('reports in_cliff with nothing vested before the cliff', () => {
    const d = deriveGrant(grant(), ms('2025-03-01T00:00:00Z'))
    expect(d.fraction).toBe(0)
    expect(d.vested).toBe(0)
    expect(d.claimable).toBe(0)
    expect(d.unvested).toBe(1000)
    expect(d.status).toBe('in_cliff')
  })

  it('subtracts already-withdrawn from claimable while vesting', () => {
    // 2025-07-01 is 181/365 of the way through → 495.89 vested.
    const d = deriveGrant(grant(100), ms('2025-07-01T00:00:00Z'))
    expect(d.vested).toBeCloseTo((1000 * 181) / 365, 2)
    expect(d.claimed).toBe(100)
    expect(d.claimable).toBeCloseTo((1000 * 181) / 365 - 100, 2)
    expect(d.status).toBe('vesting')
  })

  it('clamps claimable to zero when withdrawn exceeds vested', () => {
    const d = deriveGrant(grant(900), ms('2025-07-01T00:00:00Z'))
    expect(d.claimable).toBe(0)
  })

  it('reports fully_vested with no unvested remainder after end', () => {
    const d = deriveGrant(grant(0), ms('2026-02-01T00:00:00Z'))
    expect(d.fraction).toBe(1)
    expect(d.vested).toBe(1000)
    expect(d.unvested).toBe(0)
    expect(d.status).toBe('fully_vested')
  })

  it('guards a zero-total grant against division surprises', () => {
    const d = deriveGrant(grant(0, 0), ms('2025-07-01T00:00:00Z'))
    expect(d.vested).toBe(0)
    expect(d.claimable).toBe(0)
    expect(d.unvested).toBe(0)
  })
})

describe('refresh', () => {
  const view = (grants: Grant[]) => ({ grants, proposals: [], claims: [] })
  const reset = (): void =>
    useVestingStore.setState({
      grants: [],
      proposals: [],
      claims: [],
      loading: false,
      error: undefined,
    })

  it('loads the view and clears loading on success', async () => {
    reset()
    const backend = {
      viewAs: vi.fn().mockResolvedValue(view([grant()])),
    } as unknown as VestingBackend
    await useVestingStore.getState().refresh(backend, 'p::1')
    expect(useVestingStore.getState().grants).toHaveLength(1)
    expect(useVestingStore.getState().loading).toBe(false)
    expect(useVestingStore.getState().error).toBeUndefined()
  })

  it('surfaces the error on a failed non-silent refresh', async () => {
    reset()
    const backend = {
      viewAs: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as VestingBackend
    await useVestingStore.getState().refresh(backend, 'p::1')
    expect(useVestingStore.getState().error).toBe('boom')
  })

  // A background poll must not clobber good data or flash an error on a transient blip.
  it('silent refresh keeps prior data and swallows transient errors', async () => {
    reset()
    useVestingStore.setState({ grants: [grant()] })
    const backend = {
      viewAs: vi.fn().mockRejectedValue(new Error('blip')),
    } as unknown as VestingBackend
    await useVestingStore.getState().refresh(backend, 'p::1', { silent: true })
    expect(useVestingStore.getState().grants).toHaveLength(1)
    expect(useVestingStore.getState().error).toBeUndefined()
  })

  it('silent refresh still applies fresh data on success', async () => {
    reset()
    const backend = {
      viewAs: vi.fn().mockResolvedValue(view([grant(), grant()])),
    } as unknown as VestingBackend
    await useVestingStore.getState().refresh(backend, 'p::1', { silent: true })
    expect(useVestingStore.getState().grants).toHaveLength(2)
  })
})
