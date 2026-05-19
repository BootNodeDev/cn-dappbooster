import type { ReactNode } from 'react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button.tsx'
import { JsonPreview } from '@/components/ui/JsonPreview.tsx'
import { SectionTitle } from '@/components/ui/SectionTitle.tsx'

interface PendingActionCardProps {
  title: string
  subtitle: ReactNode
  approveLabel: string
  rejectLabel?: string
  onApprove: () => void
  onReject: () => void
  approveDisabled?: boolean
  busy?: boolean
  payload?: { summary: string; json: unknown }
  children?: ReactNode
}

export const PendingActionCard = ({
  title,
  subtitle,
  approveLabel,
  rejectLabel = 'Reject',
  onApprove,
  onReject,
  approveDisabled,
  busy,
  payload,
  children,
}: PendingActionCardProps): JSX.Element => (
  <div className="flex flex-col gap-4">
    <div className="min-w-0">
      <div className="font-mono text-[0.74rem] font-semibold tracking-[0.18em] uppercase text-success mb-2">
        Awaiting approval
      </div>
      <SectionTitle className="text-[1.45rem]">{title}</SectionTitle>
      <small className="block mt-1.5 text-soft text-[0.95rem] leading-snug">{subtitle}</small>
    </div>
    {children}
    {payload !== undefined && (
      <details className="border border-border rounded-md px-3.5 py-3 bg-muted/60 open:bg-muted transition-colors">
        <summary className="cursor-pointer text-soft font-semibold text-[0.88rem] tracking-tight">
          {payload.summary}
        </summary>
        <JsonPreview>
          {typeof payload.json === 'string' ? payload.json : JSON.stringify(payload.json, null, 2)}
        </JsonPreview>
      </details>
    )}
    <div className="grid grid-cols-2 gap-3">
      <PrimaryButton
        onClick={onApprove}
        disabled={busy || approveDisabled}
      >
        {approveLabel}
      </PrimaryButton>
      <SecondaryButton
        onClick={onReject}
        disabled={busy}
      >
        {rejectLabel}
      </SecondaryButton>
    </div>
  </div>
)
