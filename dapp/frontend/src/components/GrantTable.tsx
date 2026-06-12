import { Link } from 'react-router-dom'
import { copyPartyId } from '@/lib/clipboard'
import { formatCC, formatDate, formatPct, shortenParty } from '@/lib/format'
import { MIN_GRANT_AMOUNT } from '@/lib/schedule'
import type { Grant, Role } from '@/store/types'
import type { GrantDerived } from '@/store/useVestingStore'
import { Button } from './Button'
import { Card } from './Card'
import { CopyIcon } from './icons'
import { ScheduleBar } from './ScheduleBar'
import { StatusPill } from './StatusPill'

export interface GrantRow {
  grant: Grant
  derived: GrantDerived
}

interface GrantTableProps {
  rows: GrantRow[]
  role: Role
  onClaim?: (grant: Grant) => void
  onCancel?: (grant: Grant) => void
  onAccept?: (grant: Grant) => void
}

const statusText = (d: GrantDerived): string =>
  d.status === 'pending'
    ? 'pending'
    : d.status === 'in_cliff'
      ? 'in cliff'
      : d.status === 'fully_vested'
        ? 'vested'
        : 'vesting'

// Dense, table-driven view (Direction C) for users tracking many grants.
export const GrantTable = ({
  rows,
  role,
  onClaim,
  onCancel,
  onAccept,
}: GrantTableProps): React.JSX.Element => (
  <Card className="overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left font-mono text-[0.65rem] uppercase tracking-[0.08em] text-fg-muted">
            <th className="px-4 py-3 font-bold">Escrow</th>
            <th className="px-4 py-3 font-bold">Status</th>
            <th className="px-4 py-3 font-bold">Progress</th>
            <th className="px-4 py-3 text-right font-bold">Total</th>
            <th className="px-4 py-3 text-right font-bold">Vested</th>
            <th className="px-4 py-3 text-right font-bold">
              {role === 'beneficiary' ? 'Claimable' : 'Unvested'}
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ grant, derived }) => {
            const isPending = derived.status === 'pending'
            const claimedFraction =
              grant.totalAmount === 0 ? 0 : derived.claimed / grant.totalAmount
            const milestones =
              grant.schedule.curve.kind === 'milestone'
                ? grant.schedule.curve.points.map((p) => p.fraction)
                : undefined
            const canClaim = derived.claimable >= MIN_GRANT_AMOUNT
            const dotColor = isPending
              ? 'bg-warning'
              : derived.status === 'in_cliff'
                ? 'bg-fg-soft'
                : 'bg-success'
            return (
              <tr
                key={grant.id}
                className="border-b border-border/60 last:border-0 hover:bg-accent/[0.04]"
              >
                <td className="px-4 py-3.5">
                  {isPending ? (
                    <span className="font-bold text-fg">{grant.title}</span>
                  ) : (
                    <Link
                      to={`/grants/${grant.id}`}
                      className="font-bold text-fg hover:text-primary"
                    >
                      {grant.title}
                    </Link>
                  )}
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className="font-mono text-[0.7rem] text-fg-soft">
                      {role === 'beneficiary' ? 'from:' : 'to:'}{' '}
                      {shortenParty(role === 'beneficiary' ? grant.creator : grant.receiver)}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy party id"
                      title="Copy party id"
                      onClick={() =>
                        void copyPartyId(role === 'beneficiary' ? grant.creator : grant.receiver)
                      }
                      className="text-fg-muted transition-colors hover:text-primary"
                    >
                      <CopyIcon width={12} height={12} />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1.5 font-mono text-xs text-fg-muted">
                    <span className={`size-1.5 rounded-full ${dotColor}`} />
                    {statusText(derived)}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  {isPending ? (
                    <span className="font-mono text-[0.7rem] text-fg-muted">
                      Cliff {formatDate(grant.schedule.cliff)}
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <ScheduleBar
                        className="w-28"
                        vestedFraction={derived.fraction}
                        claimedFraction={claimedFraction}
                        milestones={milestones}
                      />
                      <span className="w-9 font-mono text-[0.7rem] text-fg-muted">
                        {formatPct(derived.fraction)}
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right font-mono">{formatCC(grant.totalAmount)}</td>
                <td className="px-4 py-3.5 text-right font-mono text-fg-muted">
                  {isPending ? '—' : formatCC(derived.vested)}
                </td>
                <td className="px-4 py-3.5 text-right font-mono">
                  {isPending ? (
                    <span className="text-fg-muted">—</span>
                  ) : role === 'beneficiary' ? (
                    <span className="font-semibold text-success">
                      {formatCC(derived.claimable)}
                    </span>
                  ) : (
                    <span className="text-fg">{formatCC(derived.unvested)}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  {isPending ? (
                    role === 'beneficiary' ? (
                      <Button size="sm" onClick={() => onAccept?.(grant)}>
                        Accept
                      </Button>
                    ) : (
                      <StatusPill tone="neutral">Awaiting</StatusPill>
                    )
                  ) : role === 'beneficiary' ? (
                    <Button size="sm" disabled={!canClaim} onClick={() => onClaim?.(grant)}>
                      Claim
                    </Button>
                  ) : (
                    <Button size="sm" variant="danger" onClick={() => onCancel?.(grant)}>
                      Cancel
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  </Card>
)
