import type { ReactNode } from 'react'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { BACK_ICON } from '@/components/ui/icons'

interface UtilDetailProps {
  title: string
  onBack: () => void
  children: ReactNode
}

// Shared back-bar + title shell that hosts a single util's content.
export const UtilDetail = ({ title, onBack, children }: UtilDetailProps): JSX.Element => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="sticky top-0 z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background/95 pb-2.5 pt-1.5 backdrop-blur">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className={`${ICON_BUTTON_CLASS} size-8 rounded-md`}
      >
        {BACK_ICON}
      </button>
      <h2 className="m-0 text-[1rem] font-semibold text-foreground">{title}</h2>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto px-1 py-3">{children}</div>
  </div>
)
