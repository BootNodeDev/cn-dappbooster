import { avatarStyle, initials } from '@/utils/account'

interface AccountAvatarProps {
  name: string
  partyId: string
}

export const AccountAvatar = ({ name, partyId }: AccountAvatarProps): JSX.Element => (
  <span
    className="size-10 shrink-0 grid place-items-center rounded-md text-white font-mono text-[0.82rem] font-bold tracking-[0.05em] ring-1 ring-black/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
    style={avatarStyle(partyId)}
  >
    {initials(name)}
  </span>
)
