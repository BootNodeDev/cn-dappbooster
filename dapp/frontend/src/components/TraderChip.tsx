import { partyName } from '@/darkpool/format'
import { TraderFace } from './TraderFace'

// A trader identity: deterministic face + short name. Used in book/fill tables.
export const TraderChip = ({ name, size = 18 }: { name: string; size?: number }): JSX.Element => (
  <span className="inline-flex items-center gap-2 font-mono text-muted-foreground">
    <span className="overflow-hidden rounded-full">
      <TraderFace name={name} size={size} />
    </span>
    {partyName(name)}
  </span>
)
