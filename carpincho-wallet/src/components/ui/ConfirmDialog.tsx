import * as AlertDialog from '@radix-ui/react-alert-dialog'
import type { ReactNode } from 'react'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button'
import { cn } from '@/utils/cn'

const OVERLAY_CLASS =
  'fixed inset-0 z-[60] bg-scrim backdrop-blur-sm data-[state=open]:animate-fade-in'

const CONTENT_CLASS = cn(
  'fixed left-1/2 top-1/2 z-[61] w-[min(100%,22rem)] [transform:translate(-50%,-50%)]',
  'flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4',
  'data-[state=open]:animate-zoom-in-and-fade',
)

const DANGER_ACTION_CLASS =
  'bg-danger border-danger enabled:hover:border-danger enabled:hover:shadow-none enabled:hover:before:opacity-0'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
}

export const ConfirmDialog = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
}: ConfirmDialogProps): JSX.Element => (
  <AlertDialog.Root
    open={open}
    onOpenChange={onOpenChange}
  >
    <AlertDialog.Portal>
      <AlertDialog.Overlay className={OVERLAY_CLASS} />
      <AlertDialog.Content
        data-testid="confirm-remove"
        className={CONTENT_CLASS}
      >
        <AlertDialog.Title className="m-0 font-display text-[1.3rem] font-semibold text-foreground">
          {title}
        </AlertDialog.Title>
        <AlertDialog.Description className="text-[0.92rem] leading-relaxed text-soft">
          {description}
        </AlertDialog.Description>
        <div className="mt-1 flex justify-end gap-3">
          <AlertDialog.Cancel asChild>
            <SecondaryButton>{cancelLabel}</SecondaryButton>
          </AlertDialog.Cancel>
          <AlertDialog.Action asChild>
            <PrimaryButton
              data-testid="confirm-remove-action"
              className={DANGER_ACTION_CLASS}
              onClick={onConfirm}
            >
              {confirmLabel}
            </PrimaryButton>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>
)
