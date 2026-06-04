import type { ReactNode } from 'react'
import { DangerButton } from '@/components/ui/Button'

interface DangerConfirmProps {
  // A mono identifier box (party id, origin, …). Omit for confirms with nothing to echo back.
  identifier?: string
  message: ReactNode
  note?: ReactNode
  confirmLabel: string
  onConfirm: () => void
  testId?: string
  confirmTestId?: string
}

// Body for a destructive-action confirm: mono identifier box, a sentence, an optional emphasis note,
// and a full-width danger button. Caller supplies the surrounding Sheet (title/description).
export const DangerConfirm = ({
  identifier,
  message,
  note,
  confirmLabel,
  onConfirm,
  testId,
  confirmTestId,
}: DangerConfirmProps): JSX.Element => (
  <div
    data-testid={testId}
    className="flex flex-col gap-4"
  >
    {identifier !== undefined && (
      <div className="rounded-md border border-border bg-muted/50 px-3 py-2.5">
        <span className="block break-all font-mono text-[0.8rem] leading-relaxed text-foreground">
          {identifier}
        </span>
      </div>
    )}
    <p className="text-soft text-[0.95rem] leading-relaxed">{message}</p>
    {note !== undefined && <p className="font-semibold text-foreground">{note}</p>}
    <DangerButton
      className="w-full"
      data-testid={confirmTestId}
      onClick={onConfirm}
    >
      {confirmLabel}
    </DangerButton>
  </div>
)
