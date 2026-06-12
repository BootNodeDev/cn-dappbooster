import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/utils/cn'

// Pill toggle for binary on/off settings; thumb slides on checked.
export const Switch = ({ className, ...props }: SwitchPrimitive.SwitchProps): JSX.Element => (
  <SwitchPrimitive.Root
    className={cn(
      'relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border border-border-strong transition-colors',
      'bg-muted data-[state=checked]:border-primary data-[state=checked]:bg-primary',
      'focus-visible:outline-none focus-visible:shadow-focus disabled:cursor-not-allowed disabled:opacity-60',
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb className="pointer-events-none block size-5 translate-x-0.5 rounded-full bg-primary-foreground shadow transition-transform data-[state=checked]:translate-x-[1.125rem]" />
  </SwitchPrimitive.Root>
)
