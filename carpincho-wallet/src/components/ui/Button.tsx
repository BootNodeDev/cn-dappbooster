import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/utils/cn'

type ButtonProps = ComponentPropsWithoutRef<'button'>

const BASE_INTERACTIVE =
  'inline-flex items-center justify-center gap-2 select-none transition ' +
  'duration-200 ease-out active:scale-[0.98] disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

export const GHOST_BUTTON_CLASS = `${BASE_INTERACTIVE} border-0 bg-transparent text-primary enabled:hover:text-primary-hover text-[0.95rem] font-semibold p-0`

export const ICON_BUTTON_CLASS =
  'inline-grid place-items-center text-muted-foreground transition-colors ' +
  'enabled:hover:text-primary enabled:hover:bg-primary-soft ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

// Like ICON_BUTTON_CLASS but no hover background fill — for icons inline beside text.
export const PLAIN_ICON_BUTTON_CLASS =
  'inline-grid place-items-center rounded-sm text-muted-foreground transition-colors ' +
  'hover:text-primary focus-visible:outline-none focus-visible:shadow-focus'

export const ROUND_ICON_BUTTON_CHROME =
  'rounded-md border border-border text-soft enabled:hover:border-border-strong'

const VARIANT_CLASS = {
  primary:
    `${BASE_INTERACTIVE} relative isolate overflow-hidden py-2.5 px-4 leading-none rounded-md font-semibold text-[0.94rem] text-primary-foreground ` +
    'bg-primary border border-primary enabled:hover:border-transparent enabled:hover:shadow-glow ' +
    'before:absolute before:inset-0 before:-z-10 before:rounded-[inherit] before:bg-[image:var(--bg-gradient-brand)] ' +
    'before:opacity-0 before:transition-opacity before:duration-200 enabled:hover:before:opacity-100',
  secondary:
    `${BASE_INTERACTIVE} py-2.5 px-4 leading-none rounded-md font-semibold text-[0.94rem] text-foreground ` +
    'bg-surface border border-border-strong enabled:hover:bg-muted enabled:hover:text-primary',
  ghost: GHOST_BUTTON_CLASS,
} as const

export const PrimaryButton = ({
  type = 'button',
  className,
  ...rest
}: ButtonProps): JSX.Element => (
  <button
    type={type}
    className={cn(VARIANT_CLASS.primary, className)}
    {...rest}
  />
)

export const SecondaryButton = ({
  type = 'button',
  className,
  ...rest
}: ButtonProps): JSX.Element => (
  <button
    type={type}
    className={cn(VARIANT_CLASS.secondary, className)}
    {...rest}
  />
)

export const GhostButton = ({ type = 'button', className, ...rest }: ButtonProps): JSX.Element => (
  <button
    type={type}
    className={cn(VARIANT_CLASS.ghost, className)}
    {...rest}
  />
)
