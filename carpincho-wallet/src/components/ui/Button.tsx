import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/utils/cn.ts'

type ButtonProps = ComponentPropsWithoutRef<'button'>

const BASE_INTERACTIVE =
  'inline-flex items-center justify-center gap-2 select-none transition ' +
  'duration-180 ease-out active:scale-[0.98] disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

export const GHOST_BUTTON_CLASS = `${BASE_INTERACTIVE} border-0 bg-transparent text-primary hover:text-primary-hover text-[0.95rem] font-semibold p-0`

export const ICON_BUTTON_CLASS =
  'inline-grid place-items-center text-muted-foreground transition-colors ' +
  'hover:text-primary hover:bg-primary-soft ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

export const ROUND_ICON_BUTTON_CHROME =
  'rounded-full border border-border text-soft hover:border-border-strong'

const VARIANT_CLASS = {
  primary:
    `${BASE_INTERACTIVE} py-[0.55rem] px-4 leading-none rounded-full font-semibold text-[0.98rem] text-primary-foreground ` +
    'bg-primary border border-primary hover:bg-primary-hover hover:border-primary-hover',
  secondary:
    `${BASE_INTERACTIVE} py-[0.55rem] px-4 leading-none rounded-full font-semibold text-[0.98rem] text-foreground ` +
    'bg-surface border border-border-strong hover:bg-muted hover:text-primary',
  ghost: GHOST_BUTTON_CLASS,
  pill:
    `${BASE_INTERACTIVE} py-[6px] px-3.5 rounded-full text-soft text-[0.9rem] font-semibold ` +
    'bg-surface/85 border border-border hover:bg-muted hover:text-primary hover:border-border-strong',
} as const

type Variant = keyof typeof VARIANT_CLASS

interface ButtonVariantProps extends ButtonProps {
  variant: Variant
}

export const Button = ({
  variant,
  type = 'button',
  className,
  ...rest
}: ButtonVariantProps): JSX.Element => (
  <button
    type={type}
    className={cn(VARIANT_CLASS[variant], className)}
    {...rest}
  />
)

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

export const PillButton = ({ type = 'button', className, ...rest }: ButtonProps): JSX.Element => (
  <button
    type={type}
    className={cn(VARIANT_CLASS.pill, className)}
    {...rest}
  />
)
