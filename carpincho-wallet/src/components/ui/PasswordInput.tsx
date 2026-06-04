import { type ComponentPropsWithoutRef, forwardRef, useState } from 'react'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { EYE_ICON, EYE_OFF_ICON } from '@/components/ui/icons'
import { TextInput } from '@/components/ui/TextInput'
import { cn } from '@/utils/cn'

type PasswordInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type'> & {
  error?: boolean
}

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, error, ...rest }, ref) => {
    const [visible, setVisible] = useState(false)
    const label = visible ? 'Hide password' : 'Show password'
    return (
      <div className="relative">
        <TextInput
          ref={ref}
          type={visible ? 'text' : 'password'}
          error={error}
          className={cn('pr-11', className)}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={label}
          aria-pressed={visible}
          title={label}
          className={cn(
            ICON_BUTTON_CLASS,
            'absolute right-1.5 top-1/2 -translate-y-1/2 size-7 rounded-md',
          )}
        >
          {visible ? EYE_OFF_ICON : EYE_ICON}
        </button>
      </div>
    )
  },
)

PasswordInput.displayName = 'PasswordInput'
