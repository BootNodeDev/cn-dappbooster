import * as RadixTooltip from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { InfoIcon } from './icons'

// A small info affordance next to a label. Built on Radix Tooltip so it is keyboard
// focusable, dismissible, and screen-reader friendly out of the box.
export const InfoTooltip = ({
  label,
  children,
}: {
  label: string
  children: ReactNode
}): React.JSX.Element => (
  <RadixTooltip.Provider delayDuration={150}>
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className="inline-grid place-items-center text-fg-muted/70 transition-colors hover:text-fg focus-visible:outline-none focus-visible:text-fg"
        >
          <InfoIcon width={14} height={14} />
        </button>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          collisionPadding={12}
          className="z-50 max-w-[16rem] rounded-lg border border-border bg-surface px-3 py-2 text-xs font-normal normal-case leading-relaxed text-fg-muted shadow-[var(--shadow-popover)]"
        >
          {children}
          <RadixTooltip.Arrow className="fill-surface" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
)
