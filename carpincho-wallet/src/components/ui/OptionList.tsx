import { CHECK_ICON } from '@/components/ui/icons'
import { MENU_ROW_BASE_CLASS } from '@/components/ui/MenuRow'
import { cn } from '@/utils/cn'

interface OptionListProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onSelect: (value: T) => void
}

// Single-select row list; marks the active value with a check. Shared by Theme and Auto-lock.
export const OptionList = <T extends string>({
  options,
  value,
  onSelect,
}: OptionListProps<T>): JSX.Element => (
  <ul className="flex flex-col gap-1.5 list-none m-0 p-0">
    {options.map((opt) => {
      const active = value === opt.value
      return (
        <li key={opt.value}>
          <button
            type="button"
            aria-current={active ? 'true' : undefined}
            onClick={() => onSelect(opt.value)}
            className={cn(
              MENU_ROW_BASE_CLASS,
              'flex items-center justify-between text-left text-foreground',
              active && 'border-primary text-primary',
            )}
          >
            <span className="font-medium">{opt.label}</span>
            {active && CHECK_ICON}
          </button>
        </li>
      )
    })}
  </ul>
)
