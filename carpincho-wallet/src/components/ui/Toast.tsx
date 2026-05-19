import * as RadixToast from '@radix-ui/react-toast'
import { type ReactNode, useEffect, useState } from 'react'
import {
  FEEDBACK_BASE_CLASS,
  FEEDBACK_VARIANT_CLASS,
  type FeedbackVariant,
} from '@/components/ui/Alert.tsx'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button.tsx'
import { X_ICON } from '@/components/ui/icons.tsx'
import {
  resolveDurationMs,
  subscribeToasts,
  type ToastEntry,
  toast,
} from '@/components/ui/toast.ts'
import { cn } from '@/utils/cn.ts'

const CLOSE_ANIMATION_MS = 200

const VIEWPORT_CLASS =
  'fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 ' +
  'w-[min(100%_-_1rem,28rem)] outline-none m-0 p-0 list-none'

const BASE_TOAST_CLASS = cn(
  FEEDBACK_BASE_CLASS,
  'shadow-popover flex items-center justify-between gap-3',
  'data-[state=open]:animate-slide-down-and-fade data-[state=closed]:animate-fade-in',
  'data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)]',
  'data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-[transform_200ms_ease-out]',
  'data-[swipe=end]:animate-fade-in',
)

const ANNOUNCE_TYPE: Record<FeedbackVariant, 'foreground' | 'background'> = {
  info: 'background',
  success: 'background',
  warning: 'foreground',
  error: 'foreground',
}

interface ToastItemProps {
  entry: ToastEntry
}

const ToastItem = ({ entry }: ToastItemProps): JSX.Element => {
  return (
    <RadixToast.Root
      duration={resolveDurationMs(entry.durationMs)}
      type={ANNOUNCE_TYPE[entry.variant]}
      onOpenChange={(open) => {
        if (!open) {
          window.setTimeout(() => toast.dismiss(entry.id), CLOSE_ANIMATION_MS)
        }
      }}
      className={cn(BASE_TOAST_CLASS, FEEDBACK_VARIANT_CLASS[entry.variant])}
    >
      <RadixToast.Description className="min-w-0 grow break-words">
        {entry.message}
      </RadixToast.Description>
      <RadixToast.Close
        aria-label="Dismiss"
        className={cn(
          ICON_BUTTON_CLASS,
          'shrink-0 size-7 rounded-full text-current bg-transparent',
        )}
      >
        {X_ICON}
      </RadixToast.Close>
    </RadixToast.Root>
  )
}

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider = ({ children }: ToastProviderProps): JSX.Element => {
  const [entries, setEntries] = useState<ReadonlyArray<ToastEntry>>([])
  useEffect(() => subscribeToasts(setEntries), [])
  return (
    <RadixToast.Provider swipeDirection="up">
      {children}
      {entries
        .slice()
        .reverse()
        .map((entry) => (
          <ToastItem
            key={entry.id}
            entry={entry}
          />
        ))}
      <RadixToast.Viewport className={VIEWPORT_CLASS} />
    </RadixToast.Provider>
  )
}
