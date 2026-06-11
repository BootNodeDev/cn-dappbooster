import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AmountDisplay } from '@/components/AmountDisplay'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { ClaimDialog } from '@/components/ClaimDialog'
import { EmptyState } from '@/components/EmptyState'
import { GrantCard } from '@/components/GrantCard'
import { type GrantRow, GrantTable } from '@/components/GrantTable'
import {
  CardsIcon,
  CheckIcon,
  ChevronDownIcon,
  FilterIcon,
  PlusIcon,
  TableIcon,
} from '@/components/icons'
import { KpiCard } from '@/components/KpiCard'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { now, useNow } from '@/lib/clock'
import { cn } from '@/lib/cn'
import type { Grant, VestedClaim } from '@/store/types'
import { useUiStore } from '@/store/useUiStore'
import { deriveGrant, useVesting, useVestingStore } from '@/store/useVestingStore'

type Filter = 'all' | 'claimable' | 'cliff' | 'milestone'
const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'claimable', label: 'Claimable' },
  { value: 'cliff', label: 'In cliff' },
  { value: 'milestone', label: 'Milestone' },
]

interface ClaimTarget {
  kind: 'grant' | 'claim'
  id: string
  available: number
}

export const DashboardPage = (): React.JSX.Element => {
  const nowMs = useNow()
  const { backend, partyId } = useVesting()
  const role = useUiStore((s) => s.role)
  const view = useUiStore((s) => s.dashboardView)
  const setView = useUiStore((s) => s.setDashboardView)

  const grants = useVestingStore((s) => s.grants)
  const claims = useVestingStore((s) => s.claims)
  const withdraw = useVestingStore((s) => s.withdraw)
  const claimResidual = useVestingStore((s) => s.claimResidual)
  const cancel = useVestingStore((s) => s.cancel)

  const [filter, setFilter] = useState<Filter>('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Grant | null>(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!filterOpen) {
      return
    }
    const onDown = (e: PointerEvent): void => {
      if (filterRef.current !== null && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false)
      }
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [filterOpen])

  const activeFilterLabel = filters.find((f) => f.value === filter)?.label ?? 'All'

  const rows = useMemo<GrantRow[]>(() => {
    const mine = grants.filter((g) =>
      role === 'beneficiary' ? g.receiver === partyId : g.creator === partyId,
    )
    return mine.map((grant) => ({ grant, derived: deriveGrant(grant, nowMs) }))
  }, [grants, role, partyId, nowMs])

  const filtered = useMemo(
    () =>
      rows.filter(({ grant, derived }) => {
        if (filter === 'claimable') {
          return derived.claimable > 0
        }
        if (filter === 'cliff') {
          return derived.status === 'in_cliff'
        }
        if (filter === 'milestone') {
          return grant.schedule.curve.kind === 'milestone'
        }
        return true
      }),
    [rows, filter],
  )

  const myClaims = useMemo(
    () => (role === 'beneficiary' ? claims.filter((c) => c.receiver === partyId) : []),
    [claims, role, partyId],
  )

  const totals = useMemo(() => {
    const acc = { total: 0, vested: 0, claimable: 0, claimed: 0, unvested: 0 }
    for (const { grant, derived } of rows) {
      acc.total += grant.totalAmount
      acc.vested += derived.vested
      acc.claimable += derived.claimable
      acc.claimed += derived.claimed
      acc.unvested += derived.unvested
    }
    return acc
  }, [rows])

  const residualClaimable = myClaims.reduce((sum, c) => sum + (c.amount - c.withdrawn), 0)

  const onConfirmClaim = async (amount: number): Promise<void> => {
    if (claimTarget === null) {
      return
    }
    if (claimTarget.kind === 'grant') {
      await withdraw(backend, partyId, claimTarget.id, amount)
    } else {
      await claimResidual(backend, partyId, claimTarget.id, amount)
    }
  }

  const onConfirmCancel = async (): Promise<void> => {
    if (cancelTarget === null) {
      return
    }
    setCancelling(true)
    try {
      await cancel(backend, partyId, cancelTarget.id)
      toast.success('Escrow cancelled; earned residual set aside for the beneficiary')
      setCancelTarget(null)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setCancelling(false)
    }
  }

  const openClaim = (grant: Grant): void => {
    const derived = deriveGrant(grant, now())
    setClaimTarget({
      kind: 'grant',
      id: grant.id,
      available: derived.claimable,
    })
  }
  const openResidual = (claim: VestedClaim): void => {
    setClaimTarget({
      kind: 'claim',
      id: claim.id,
      available: claim.amount - claim.withdrawn,
    })
  }

  return (
    <div className="flex flex-col gap-7">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {role === 'beneficiary' ? (
          <>
            <KpiCard
              hero
              label="Claimable now"
              amount={totals.claimable}
              sub={`Across ${rows.length} escrows`}
              subTone="success"
              hint="Tokens that have unlocked and are yours to withdraw right now, across all the escrows vesting to you."
            />
            <KpiCard
              label="Total escrowed"
              amount={totals.total}
              sub={`${rows.length} active`}
              hint="The full amount set aside for you, whether it has vested yet or not."
            />
            <KpiCard
              label="Vested to date"
              amount={totals.vested}
              hint="How much has unlocked so far on each schedule — including what you've already claimed."
            />
            <KpiCard
              label="Already claimed"
              amount={totals.claimed}
              hint="Tokens you've already withdrawn from your escrows into your wallet."
            />
          </>
        ) : (
          <>
            <KpiCard
              hero
              label="Total committed"
              amount={totals.total}
              sub={`${rows.length} escrows funded`}
              hint="The full amount you've locked into escrows for others. It leaves your balance once a proposal is accepted."
            />
            <KpiCard
              label="Vested to date"
              amount={totals.vested}
              hint="How much of what you committed has unlocked for the beneficiaries so far."
            />
            <KpiCard
              label="Unvested (clawbackable)"
              amount={totals.unvested}
              hint="The part that hasn't unlocked yet. If you cancel an escrow, this is what returns to you."
            />
            <KpiCard
              label="Active escrows"
              amount={rows.length}
              unit=""
              hint="How many of the escrows you created are currently live."
            />
          </>
        )}
      </div>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-haspopup="true"
              aria-expanded={filterOpen}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-fg transition-colors hover:border-primary"
            >
              <FilterIcon width={15} height={15} className="text-fg-muted" />
              {activeFilterLabel}
              <ChevronDownIcon width={14} height={14} className="text-fg-muted" />
            </button>
            {filterOpen && (
              <div className="absolute right-0 z-40 mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-popover)]">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => {
                      setFilter(f.value)
                      setFilterOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                      filter === f.value
                        ? 'bg-accent/12 text-accent'
                        : 'text-fg-muted hover:bg-muted hover:text-fg',
                    )}
                  >
                    {f.label}
                    {filter === f.value && <CheckIcon width={13} height={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="inline-flex rounded-lg border border-border bg-surface p-1">
            {(
              [
                ['cards', CardsIcon, 'Card view'],
                ['table', TableIcon, 'Table view'],
              ] as const
            ).map(([v, Icon, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-label={label}
                title={label}
                aria-pressed={view === v}
                className={cn(
                  'grid size-7 place-items-center rounded-md transition-colors',
                  view === v ? 'bg-primary-soft text-fg' : 'text-fg-muted hover:text-fg',
                )}
              >
                <Icon width={16} height={16} />
              </button>
            ))}
          </div>
        </div>
        {role === 'manager' && (
          <Link
            to="/create"
            aria-label="Create escrow"
            title="Create escrow"
            className="ml-auto grid size-9 place-items-center rounded-full border border-primary bg-primary text-primary-fg transition-colors hover:shadow-[var(--glow)]"
          >
            <PlusIcon width={18} height={18} />
          </Link>
        )}
      </div>

      {/* grants */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No escrows here"
          description={
            role === 'beneficiary'
              ? 'No escrows match this filter. Accepted proposals appear here.'
              : 'You have not funded any escrows matching this filter yet.'
          }
        />
      ) : view === 'cards' ? (
        <div className="flex flex-col gap-4">
          {filtered.map(({ grant, derived }) => (
            <GrantCard
              key={grant.id}
              grant={grant}
              derived={derived}
              role={role}
              nowMs={nowMs}
              onClaim={openClaim}
              onCancel={setCancelTarget}
            />
          ))}
        </div>
      ) : (
        <GrantTable rows={filtered} role={role} onClaim={openClaim} onCancel={setCancelTarget} />
      )}

      {/* residual claims (beneficiary) */}
      {role === 'beneficiary' && myClaims.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-fg">Residual claims</h2>
            <span className="font-mono text-xs text-fg-muted">
              {residualClaimable > 0 ? `${residualClaimable.toLocaleString()} CC claimable` : ''}
            </span>
          </div>
          {myClaims.map((claim) => (
            <Card key={claim.id} className="flex items-center justify-between gap-4 p-5">
              <div>
                <div className="text-base font-bold text-fg">{claim.title}</div>
                <p className="mt-1 text-sm text-fg-muted">{claim.note}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                    Claimable
                  </div>
                  <AmountDisplay
                    value={claim.amount - claim.withdrawn}
                    className="text-lg font-semibold text-success"
                  />
                </div>
                <Button size="sm" onClick={() => openResidual(claim)}>
                  Claim
                </Button>
              </div>
            </Card>
          ))}
        </section>
      )}

      {claimTarget !== null && (
        <ClaimDialog
          open
          onClose={() => setClaimTarget(null)}
          title={claimTarget.kind === 'grant' ? 'Claim vested CC' : 'Claim residual'}
          available={claimTarget.available}
          onConfirm={onConfirmClaim}
        />
      )}

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title="Cancel escrow"
        description={
          cancelTarget === null
            ? ''
            : `Vested-but-unclaimed CC is set aside as a residual claim for ${cancelTarget.receiver.split('::')[0]}.`
        }
      >
        {cancelTarget !== null && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-bg/40 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-muted">Returned to you</span>
                <AmountDisplay
                  value={deriveGrant(cancelTarget, nowMs).unvested}
                  className="font-semibold"
                />
              </div>
              <div className="mt-1.5 flex justify-between">
                <span className="text-fg-muted">Residual to beneficiary</span>
                <AmountDisplay
                  value={deriveGrant(cancelTarget, nowMs).claimable}
                  className="font-semibold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCancelTarget(null)}
                disabled={cancelling}
              >
                Keep escrow
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => void onConfirmCancel()}
                disabled={cancelling}
              >
                {cancelling ? 'Submitting…' : 'Cancel escrow'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
