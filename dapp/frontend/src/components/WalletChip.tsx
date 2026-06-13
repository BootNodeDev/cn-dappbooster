import Avatar from 'boring-avatars'
import { formatPartyId } from '@/utils/formatPartyId'

export const WalletChip = ({ partyId }: { partyId: string }): JSX.Element => (
  <span className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm">
    <Avatar
      size={18}
      name={partyId}
      variant="beam"
      colors={['#36E0FF', '#7DF9FF', '#0E7FA6', '#1FA9D6', '#04161F']}
    />
    <span className="font-mono">{formatPartyId(partyId)}</span>
  </span>
)
