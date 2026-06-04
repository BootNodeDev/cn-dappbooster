import { type ComponentPropsWithoutRef, forwardRef } from 'react'
import { cn } from '@/utils/cn'

type ButtonProps = ComponentPropsWithoutRef<'button'>

const BASE_INTERACTIVE =
  'inline-flex items-center justify-center gap-2 select-none transition ' +
  'duration-200 ease-out active:scale-[0.98] disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

export const ICON_BUTTON_CLASS =
  'inline-grid place-items-center text-muted-foreground transition-colors ' +
  'enabled:hover:text-primary enabled:hover:bg-primary-soft ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

const SECONDARY_CLASS =
  `${BASE_INTERACTIVE} py-2.5 px-4 leading-none rounded-md font-semibold text-[0.94rem] text-foreground ` +
  'bg-surface border border-border-strong enabled:hover:bg-muted enabled:hover:text-primary'

export const SecondaryButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ type = 'button', className, ...rest }, ref) => (
    <button ref={ref} type={type} className={cn(SECONDARY_CLASS, className)} {...rest} />
  ),
)
SecondaryButton.displayName = 'SecondaryButton'
