import * as Dialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { ICON_BUTTON_CLASS, ROUND_ICON_BUTTON_CHROME } from '@/components/ui/Button.tsx'
import { BACK_ICON, X_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'

type Side = 'bottom' | 'right'

const OVERLAY_CLASS =
  'fixed inset-0 z-40 bg-scrim backdrop-blur-sm data-[state=open]:animate-fade-in'

const CONTENT_BASE_CLASS = 'fixed z-50 flex flex-col border-border-strong bg-surface p-4 pt-3'

const CONTENT_CLASS_BY_SIDE: Record<Side, string> = {
  bottom: cn(
    CONTENT_BASE_CLASS,
    'left-1/2 -translate-x-1/2 bottom-0 w-popup max-h-sheet',
    'rounded-t-2xl border-t border-x data-[state=open]:animate-sheet-up',
  ),
  right: cn(
    CONTENT_BASE_CLASS,
    'inset-y-0 right-0 w-drawer max-w-[100vw]',
    'border-l data-[state=open]:animate-sheet-slide-right',
  ),
}

const SHEET_ICON_BUTTON_CLASS = cn(ICON_BUTTON_CLASS, ROUND_ICON_BUTTON_CHROME, 'size-8 bg-surface')

interface SheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onBack?: () => void
  side?: Side
  children: ReactNode
}

export const Sheet = ({
  open,
  onOpenChange,
  title,
  description,
  onBack,
  side = 'bottom',
  children,
}: SheetProps): JSX.Element => (
  <Dialog.Root
    open={open}
    onOpenChange={onOpenChange}
  >
    <Dialog.Portal>
      <Dialog.Overlay className={OVERLAY_CLASS} />
      <Dialog.Content className={CONTENT_CLASS_BY_SIDE[side]}>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBack !== undefined && (
              <button
                type="button"
                aria-label="Back"
                onClick={onBack}
                className={SHEET_ICON_BUTTON_CLASS}
              >
                {BACK_ICON}
              </button>
            )}
            <Dialog.Title className="m-0 font-display text-[1.55rem] font-semibold tracking-[-0.02em] text-foreground truncate">
              {title}
            </Dialog.Title>
          </div>
          <Dialog.Close
            aria-label="Close"
            className={SHEET_ICON_BUTTON_CLASS}
          >
            {X_ICON}
          </Dialog.Close>
        </div>
        <Dialog.Description className="sr-only">{description}</Dialog.Description>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
)
