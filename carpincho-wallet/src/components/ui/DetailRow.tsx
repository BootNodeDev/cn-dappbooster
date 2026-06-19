import { Copyable } from '@/components/ui/Copyable'

interface DetailRowProps {
  label: string
  value: string
  copyLabel?: string
}

// Label/value pair for the detail sheets; the copy control sits next to the title, value below.
export const DetailRow = ({ label, value, copyLabel }: DetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <div className="flex items-center gap-1.5">
      <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
      {copyLabel === undefined ? null : (
        <Copyable
          value={value}
          label={copyLabel}
        />
      )}
    </div>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)
