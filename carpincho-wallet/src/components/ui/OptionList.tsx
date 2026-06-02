import { CHECK_ICON } from '@/components/ui/icons.tsx'
import { MENU_ROW_BASE_CLASS } from '@/components/ui/MenuRow.tsx'
import { cn } from '@/utils/cn.ts'

interface OptionListProps<T extends string> {
  options: Array<{ value: T; label: string }>
  value: T
  onSelect: (value: T) => void
}

// Single-select list: each option is a full-width row that marks the active
// value with a check icon. Shared by the Theme and Auto-lock menu screens.
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
