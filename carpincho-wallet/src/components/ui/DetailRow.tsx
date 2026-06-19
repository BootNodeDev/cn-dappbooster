interface DetailRowProps {
  label: string
  value: string
}

// Label/value pair for the detail sheets; keeps long mono values readable.
export const DetailRow = ({ label, value }: DetailRowProps): JSX.Element => (
  <div className="grid gap-1">
    <dt className="text-[0.7rem] font-semibold uppercase text-muted-foreground">{label}</dt>
    <dd className="m-0 break-all font-mono text-[0.74rem] leading-5 text-foreground">{value}</dd>
  </div>
)
