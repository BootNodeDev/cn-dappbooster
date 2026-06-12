import { Link } from 'react-router-dom'
import { formatDate, formatPct, relativeTime, shortenParty } from '@/lib/format'
import { MIN_GRANT_AMOUNT, nextMilestone } from '@/lib/schedule'
import type { Grant, Role } from '@/store/types'
import type { GrantDerived } from '@/store/useVestingStore'
import { AmountDisplay } from './AmountDisplay'
import { Button } from './Button'
import { Card } from './Card'
import { CopyIcon, LockIcon } from './icons'
import { Legend } from './Legend'
import { ScheduleBar } from './ScheduleBar'
import { StatusPill } from './StatusPill'
import { toast } from './toast'

const copyPartyId = async (partyId: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(partyId)
    toast.success('Party id copied')
  } catch {
    toast.error('Could not copy')
  }
}

interface GrantCardProps {
  grant: Grant
  derived: GrantDerived
  role: Role
  nowMs: number
  onClaim?: (grant: Grant) => void
  onCancel?: (grant: Grant) => void
  onAccept?: (grant: Grant) => void
}

const scheduleMeta = (grant: Grant, derived: GrantDerived, nowMs: number): string => {
  if (derived.status === 'in_cliff') {
    return `Cliff ${relativeTime(grant.schedule.cliff, nowMs)}`
  }
  if (derived.status === 'fully_vested') {
    return 'Fully vested'
  }
  if (grant.schedule.curve.kind === 'linear') {
    return `Ends ${formatDate(grant.schedule.curve.end)}`
  }
  const next = nextMilestone(grant.schedule, nowMs)
  return next === undefined ? 'Final milestone pending' : `Next ${formatDate(next.time)}`
}

export const GrantCard = ({
  grant,
  derived,
  role,
  nowMs,
  onClaim,
  onCancel,
  onAccept,
}: GrantCardProps): React.JSX.Element => {
  const curve = grant.schedule.curve
  const isMilestone = curve.kind === 'milestone'
  const milestones = curve.kind === 'milestone' ? curve.points.map((p) => p.fraction) : undefined
  const claimedFraction = grant.totalAmount === 0 ? 0 : derived.claimed / grant.totalAmount
  const canClaim = derived.claimable >= MIN_GRANT_AMOUNT
  const isPending = derived.status === 'pending'
  const counterparty = role === 'beneficiary' ? grant.creator : grant.receiver
  const counterpartyLabel = role === 'beneficiary' ? 'from:' : 'to:'

  return (
    <Card className="grid gap-5 p-5 md:grid-cols-[1.5fr_2.2fr_auto] md:items-center md:gap-7">
      <div className="min-w-0">
        {isPending ? (
          <span className="text-base font-bold tracking-tight text-fg">{grant.title}</span>
        ) : (
          <Link
            to={`/grants/${grant.id}`}
            className="text-base font-bold tracking-tight text-fg transition-colors hover:text-primary"
          >
            {grant.title}
          </Link>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <StatusPill tone={isMilestone ? 'milestone' : 'linear'}>
            {isMilestone ? 'Milestone' : 'Linear'}
          </StatusPill>
          {isPending ? (
            <StatusPill tone="warning">Pending</StatusPill>
          ) : derived.status === 'in_cliff' ? (
            <StatusPill tone="neutral">In cliff</StatusPill>
          ) : derived.status === 'fully_vested' ? (
            <StatusPill tone="success">Fully vested</StatusPill>
          ) : (
            <StatusPill tone="success">Vesting</StatusPill>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          <span className="font-mono text-xs text-fg-soft">
            {counterpartyLabel} {shortenParty(counterparty)}
          </span>
          <button
            type="button"
            aria-label="Copy party id"
            title="Copy party id"
            onClick={() => void copyPartyId(counterparty)}
            className="text-fg-muted transition-colors hover:text-primary"
          >
            <CopyIcon width={13} height={13} />
          </button>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between text-xs text-fg-muted">
          {isPending ? (
            <>
              <span>Cliff {formatDate(grant.schedule.cliff)}</span>
              <span>
                {curve.kind === 'milestone'
                  ? `${curve.points.length} milestones`
                  : `${formatDate(curve.start)} → ${formatDate(curve.end)}`}
              </span>
            </>
          ) : (
            <>
              <span>Vested {formatPct(derived.fraction)}</span>
              <span>{scheduleMeta(grant, derived, nowMs)}</span>
            </>
          )}
        </div>
        <ScheduleBar
          vestedFraction={derived.fraction}
          claimedFraction={claimedFraction}
          milestones={milestones}
        />
        <Legend
          className="mt-3"
          items={[
            { label: 'Vested', value: derived.vested, swatch: 'bg-[image:var(--gradient-brand)]' },
            { label: 'Claimable', value: derived.claimable, swatch: 'bg-success' },
            { label: 'Claimed', value: derived.claimed, swatch: 'bg-surface-2' },
          ]}
        />
      </div>

      <div className="flex flex-col items-stretch gap-2.5 md:items-end">
        {isPending ? (
          <>
            <div className="md:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                Total
              </div>
              <AmountDisplay value={grant.totalAmount} className="text-xl font-semibold text-fg" />
            </div>
            {role === 'beneficiary' ? (
              <Button size="sm" onClick={() => onAccept?.(grant)} className="md:w-auto">
                Accept
              </Button>
            ) : (
              <StatusPill tone="neutral">Awaiting</StatusPill>
            )}
          </>
        ) : role === 'beneficiary' ? (
          <>
            <div className="md:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                Claimable
              </div>
              <AmountDisplay
                value={derived.claimable}
                className="text-xl font-semibold text-success"
              />
            </div>
            {derived.status === 'in_cliff' ? (
              <span className="inline-flex items-center justify-center gap-1.5 font-mono text-xs text-fg-muted">
                <LockIcon width={14} height={14} /> Locked until cliff
              </span>
            ) : (
              <Button
                size="sm"
                disabled={!canClaim}
                onClick={() => onClaim?.(grant)}
                className="md:w-auto"
              >
                Claim
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="md:text-right">
              <div className="text-[0.7rem] font-semibold uppercase tracking-[0.07em] text-fg-muted">
                Unvested
              </div>
              <AmountDisplay value={derived.unvested} className="text-xl font-semibold text-fg" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" asLink to={`/grants/${grant.id}`}>
                Details
              </Button>
              <Button size="sm" variant="danger" onClick={() => onCancel?.(grant)}>
                Cancel
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
