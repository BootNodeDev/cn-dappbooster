import * as RadixSelect from '@radix-ui/react-select'
import { forwardRef, type ReactNode } from 'react'
import { INPUT_CLASS } from '@/components/ui/TextInput'
import { cn } from '@/utils/cn'

type SelectProps = {
  id?: string
  className?: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  children: ReactNode
}

export const Select = ({
  id,
  className,
  value,
  onValueChange,
  placeholder,
  disabled,
  children,
}: SelectProps): JSX.Element => (
  <RadixSelect.Root
    value={value}
    onValueChange={onValueChange}
    disabled={disabled}
  >
    <RadixSelect.Trigger
      id={id}
      className={cn(
        INPUT_CLASS,
        'flex items-center justify-between gap-2 text-left data-[placeholder]:text-form-placeholder',
        className,
      )}
    >
      <RadixSelect.Value placeholder={placeholder} />
      <RadixSelect.Icon className="text-muted-foreground shrink-0">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content
        position="popper"
        sideOffset={6}
        className={cn(
          'z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden',
          'rounded-lg border border-border-strong bg-surface shadow-popover',
          'data-[state=open]:animate-slide-down-and-fade',
        )}
      >
        <RadixSelect.Viewport className="p-1">{children}</RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
)

type SelectItemProps = {
  value: string
  disabled?: boolean
  className?: string
  children: ReactNode
}

export const SelectItem = forwardRef<HTMLDivElement, SelectItemProps>(
  ({ value, disabled, className, children }, ref) => (
    <RadixSelect.Item
      ref={ref}
      value={value}
      disabled={disabled}
      className={cn(
        'relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-base text-foreground outline-none',
        'data-[highlighted]:bg-primary-soft data-[highlighted]:text-primary-ink data-[state=checked]:font-bold data-[state=checked]:text-primary',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60',
        className,
      )}
    >
      <RadixSelect.ItemText>{children}</RadixSelect.ItemText>
    </RadixSelect.Item>
  ),
)

SelectItem.displayName = 'SelectItem'
