import { type ComponentPropsWithoutRef, forwardRef } from 'react'
import { cn } from '@/utils/cn'

export const INPUT_CLASS =
  'block w-full px-4 py-2.5 text-foreground bg-surface border border-border-strong ' +
  'rounded-md text-base leading-[1.5] transition-colors ' +
  'focus:border-primary focus:outline-0 focus:shadow-focus ' +
  'placeholder:text-form-placeholder'

type TextInputProps = ComponentPropsWithoutRef<'input'> & {
  error?: boolean
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ className, error, ...rest }, ref) => (
    <input
      ref={ref}
      aria-invalid={error ? true : undefined}
      className={cn(
        INPUT_CLASS,
        error && 'border-danger focus:border-danger shadow-focus-danger focus:shadow-focus-danger',
        className,
      )}
      {...rest}
    />
  ),
)

TextInput.displayName = 'TextInput'
