import Avatar from 'boring-avatars'
import { cn } from '@/utils/cn'

interface AccountAvatarProps {
  partyId: string
  size?: 'sm' | 'md'
}

const SIZE_PX: Record<NonNullable<AccountAvatarProps['size']>, number> = {
  sm: 24,
  md: 40,
}

const SIZE_CLASS: Record<NonNullable<AccountAvatarProps['size']>, string> = {
  sm: 'size-6',
  md: 'size-10',
}

const AVATAR_COLORS = ['#692581', '#a563bf', '#c670e5', '#e71d73', '#7d2d99']

export const AccountAvatar = ({ partyId, size = 'md' }: AccountAvatarProps): JSX.Element => (
  <span
    className={cn('shrink-0 overflow-hidden rounded-full ring-1 ring-black/10', SIZE_CLASS[size])}
  >
    <Avatar
      name={partyId}
      size={SIZE_PX[size]}
      variant="marble"
      colors={AVATAR_COLORS}
    />
  </span>
)
