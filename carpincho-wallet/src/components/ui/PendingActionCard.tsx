import type { ReactNode } from 'react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button.tsx'

interface PendingActionCardProps {
  method: string
  approveLabel: string
  rejectLabel?: string
  onApprove: () => void
  onReject: () => void
  approveDisabled?: boolean
  busy?: boolean
  payload?: { json: unknown }
  children?: ReactNode
}

// Renders one pending wallet request with fixed approval actions and a scrollable payload body.
export const PendingActionCard = ({
  method,
  approveLabel,
  rejectLabel = 'Reject',
  onApprove,
  onReject,
  approveDisabled,
  busy,
  payload,
  children,
}: PendingActionCardProps): JSX.Element => (
  <div
    className="flex h-full min-h-0 flex-col gap-3 overflow-hidden"
    data-pending-kind={method}
  >
    <div className="min-w-0 shrink-0">
      <div className="font-mono text-[0.72rem] font-semibold tracking-[0.14em] uppercase text-success">
        awaiting approval
      </div>
      <div className="mt-1 font-mono text-[0.84rem] font-medium text-muted-foreground">
        method: <span className="text-foreground">{method}</span>
      </div>
    </div>
    {children !== undefined && <div className="shrink-0">{children}</div>}
    {payload !== undefined && (
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 font-mono text-[0.84rem] font-medium text-muted-foreground">
          payload:
        </div>
        <pre className="mt-1.5 min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-[0.82rem] leading-relaxed text-soft">
          {typeof payload.json === 'string' ? payload.json : JSON.stringify(payload.json, null, 2)}
        </pre>
      </div>
    )}
    <div className="grid shrink-0 grid-cols-2 gap-3">
      <PrimaryButton
        data-testid="pending-approve"
        onClick={onApprove}
        disabled={busy || approveDisabled}
      >
        {approveLabel}
      </PrimaryButton>
      <SecondaryButton
        data-testid="pending-reject"
        onClick={onReject}
        disabled={busy}
      >
        {rejectLabel}
      </SecondaryButton>
    </div>
  </div>
)
