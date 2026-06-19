import { Copyable } from '@/components/ui/Copyable'

interface DetailRowProps {
  label: string
  value: string
  copyLabel?: string
}

// Label/value pair for the detail sheets; keeps long mono values readable, optionally copyable.
export const DetailRow = ({ label, value, copyLabel }: DetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 flex items-start gap-1.5 break-all font-mono text-[0.74rem] leading-5 text-foreground">
      <span className="min-w-0">{value}</span>
      {copyLabel === undefined ? null : (
        <Copyable
          value={value}
          label={copyLabel}
          className="mt-0.5"
        />
      )}
    </dd>
  </div>
)
