import { avatarStyle, initials } from '@/utils/account'
import { cn } from '@/utils/cn'

interface AccountAvatarProps {
  name: string
  partyId: string
  size?: 'sm' | 'md'
}

const SIZE_CLASS: Record<NonNullable<AccountAvatarProps['size']>, string> = {
  sm: 'size-6 text-[0.6rem]',
  md: 'size-10 text-[0.82rem]',
}

export const AccountAvatar = ({ name, partyId, size = 'md' }: AccountAvatarProps): JSX.Element => (
  <span
    className={cn(
      'shrink-0 grid place-items-center rounded-md text-white font-mono font-bold tracking-[0.05em] ring-1 ring-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]',
      SIZE_CLASS[size],
    )}
    style={avatarStyle(partyId)}
  >
    {initials(name)}
  </span>
)
