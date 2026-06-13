import * as ToggleGroup from '@radix-ui/react-toggle-group'
import type { Side } from '@/darkpool/types'
import { cn } from '@/utils/cn'

export const SideToggle = ({
  value,
  onChange,
  baseLabel,
}: {
  value: Side
  onChange: (s: Side) => void
  baseLabel: string
}): JSX.Element => (
  <ToggleGroup.Root
    type="single"
    aria-label="Order side"
    value={value}
    onValueChange={(v) => v && onChange(v as Side)}
    className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted p-1"
  >
    <ToggleGroup.Item
      value="Buy"
      className={cn(
        'rounded-lg py-2.5 text-sm font-semibold transition',
        value === 'Buy' ? 'bg-success-soft text-up' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      Buy {baseLabel}
    </ToggleGroup.Item>
    <ToggleGroup.Item
      value="Sell"
      className={cn(
        'rounded-lg py-2.5 text-sm font-semibold transition',
        value === 'Sell'
          ? 'bg-danger-soft text-down'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      Sell {baseLabel}
    </ToggleGroup.Item>
  </ToggleGroup.Root>
)
