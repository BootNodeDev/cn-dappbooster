import Avatar from 'boring-avatars'

// Deterministic identicon for a party id (the colourful gradient-ish avatars dApps use).
// Seeded by the party id and themed to the brand palette.
const PALETTE = ['#c670e5', '#e71d73', '#7c3aed', '#ec4899', '#a855f7']

export const PartyAvatar = ({
  id,
  size = 28,
}: {
  id: string
  size?: number
}): React.JSX.Element => <Avatar name={id} variant="beam" size={size} colors={PALETTE} />
