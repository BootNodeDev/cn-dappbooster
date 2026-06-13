import Avatar from 'boring-avatars'

// Deterministic face avatar (boring-avatars "beam") from a party id / name.
const COLORS = ['#3d7fff', '#6c3fff', '#2ecc8f', '#d8b878', '#0a0f1e']

export const TraderFace = ({ name, size = 20 }: { name: string; size?: number }): JSX.Element => (
  <Avatar size={size} name={name} variant="beam" colors={COLORS} />
)
