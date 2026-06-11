import { cn } from '@/lib/cn'
import { AmountDisplay } from './AmountDisplay'
import { InfoTooltip } from './InfoTooltip'

interface KpiCardProps {
  label: string
  amount: number
  unit?: string
  sub?: string
  subTone?: 'muted' | 'success'
  // Plain-language explanation shown in a tooltip next to the label.
  hint?: string
  // Soft highlight for the headline metric (Claimable now).
  hero?: boolean
}

export const KpiCard = ({
  label,
  amount,
  unit = 'CC',
  sub,
  subTone = 'muted',
  hint,
  hero = false,
}: KpiCardProps): React.JSX.Element => (
  <div
    className={cn(
      'relative overflow-hidden rounded-2xl border p-5',
      hero
        ? 'border-accent/35 bg-primary-soft shadow-[var(--shadow-card)]'
        : 'border-border bg-surface shadow-[var(--shadow-card)]',
    )}
  >
    <div className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-fg-muted">
      {label}
      {hint !== undefined && <InfoTooltip label={`About ${label}`}>{hint}</InfoTooltip>}
    </div>
    <AmountDisplay
      value={amount}
      unit={unit}
      gradient={hero}
      className={cn('text-[1.7rem] font-semibold tracking-tight', hero && 'text-[1.9rem]')}
    />
    {sub !== undefined && (
      <div
        className={cn(
          'mt-1.5 text-xs',
          subTone === 'success' ? 'font-semibold text-success' : 'text-fg-muted',
        )}
      >
        {sub}
      </div>
    )}
  </div>
)
