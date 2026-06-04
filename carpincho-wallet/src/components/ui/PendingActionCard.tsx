import type { ReactNode } from 'react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'

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
    className="flex flex-col gap-3"
    data-pending-kind={method}
  >
    <div className="min-w-0 font-mono text-[0.84rem] font-medium text-muted-foreground">
      method: <span className="text-foreground">{method}</span>
    </div>
    {children !== undefined && <div>{children}</div>}
    {payload !== undefined && (
      <div>
        <div className="font-mono text-[0.84rem] font-medium text-muted-foreground">payload:</div>
        <pre className="mt-1.5 max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 p-3 font-mono text-[0.82rem] leading-relaxed text-soft">
          {typeof payload.json === 'string' ? payload.json : JSON.stringify(payload.json, null, 2)}
        </pre>
      </div>
    )}
    <div className="grid grid-cols-2 gap-3">
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
