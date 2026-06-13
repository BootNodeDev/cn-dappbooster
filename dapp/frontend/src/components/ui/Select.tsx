import * as RadixSelect from '@radix-ui/react-select'

export const Select = ({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  ariaLabel?: string
}): JSX.Element => (
  <RadixSelect.Root value={value} onValueChange={onChange}>
    <RadixSelect.Trigger
      aria-label={ariaLabel}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
    >
      <RadixSelect.Value />
      <RadixSelect.Icon className="ml-2 text-muted-foreground">▾</RadixSelect.Icon>
    </RadixSelect.Trigger>
    <RadixSelect.Portal>
      <RadixSelect.Content className="rounded-lg border border-border bg-surface p-1 shadow-popover z-50">
        <RadixSelect.Viewport>
          {options.map((opt) => (
            <RadixSelect.Item
              key={opt.value}
              value={opt.value}
              className="flex cursor-pointer items-center rounded-md px-2.5 py-2 text-sm text-foreground outline-none data-[highlighted]:bg-muted"
            >
              <RadixSelect.ItemText>{opt.label}</RadixSelect.ItemText>
              <RadixSelect.ItemIndicator />
            </RadixSelect.Item>
          ))}
        </RadixSelect.Viewport>
      </RadixSelect.Content>
    </RadixSelect.Portal>
  </RadixSelect.Root>
)
