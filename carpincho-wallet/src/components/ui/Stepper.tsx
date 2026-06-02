import { CHECK_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'

export interface StepperProps {
  steps: string[]
  current: number
}

type StepState = 'complete' | 'active' | 'upcoming'

const stateOf = (index: number, current: number): StepState =>
  index < current ? 'complete' : index === current ? 'active' : 'upcoming'

const NODE_CLASS: Record<StepState, string> = {
  complete: 'bg-primary border-primary text-primary-foreground',
  active: 'border-primary text-primary bg-primary-soft',
  upcoming: 'border-border text-muted-foreground bg-surface',
}

const LABEL_CLASS: Record<StepState, string> = {
  complete: 'text-soft',
  active: 'text-foreground',
  upcoming: 'text-muted-foreground',
}

export const Stepper = ({ steps, current }: StepperProps): JSX.Element => (
  <ol
    aria-label="Setup progress"
    className="flex items-center justify-center gap-2 px-2 py-4"
  >
    {steps.map((label, i) => {
      const index = i + 1
      const state = stateOf(index, current)
      return (
        <li
          key={label}
          data-testid={`step-${index}`}
          data-state={state}
          aria-current={state === 'active' ? 'step' : undefined}
          className="flex items-center gap-2"
        >
          <span
            className={cn(
              'grid size-7 place-items-center rounded-full border font-mono text-[0.8rem] font-semibold transition-colors',
              NODE_CLASS[state],
            )}
          >
            {state === 'complete' ? CHECK_ICON : index}
          </span>
          <span className={cn('font-sans text-[0.85rem] font-medium', LABEL_CLASS[state])}>
            {label}
          </span>
          {index < steps.length && (
            <span
              aria-hidden="true"
              className={cn(
                'mx-1 h-px w-8 transition-colors',
                state === 'complete' ? 'bg-primary' : 'bg-border',
              )}
            />
          )}
        </li>
      )
    })}
  </ol>
)
