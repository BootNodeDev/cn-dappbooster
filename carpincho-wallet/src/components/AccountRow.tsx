import type { ReactNode } from 'react'
import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { shortMiddle } from '@/utils/account'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

interface AccountRowProps {
  account: AccountPublic
  withName?: boolean
  addressTrailing?: ReactNode
}

// Renders the shared account identity (avatar + party id) reused by the active account row and the
// account popup entries. When `withName` is set the account name becomes the primary label and the
// truncated party id drops to a secondary line, with an optional trailing slot beside the address
// (e.g. a copy button).
export const AccountRow = ({
  account,
  withName = false,
  addressTrailing,
}: AccountRowProps): JSX.Element => (
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <AccountAvatar
      name={account.name}
      partyId={account.partyId}
    />
    <div className="min-w-0 flex-1">
      {withName && (
        <span className="block truncate text-[0.9rem] font-semibold text-foreground">
          {account.name}
        </span>
      )}
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          title={withName ? account.partyId : account.name}
          className={cn(
            'min-w-0 truncate font-mono text-foreground',
            withName
              ? 'text-[0.75rem] font-medium text-muted-foreground'
              : 'text-[0.9rem] font-semibold',
          )}
        >
          {shortMiddle(account.partyId, 12, 7)}
        </span>
        {addressTrailing}
      </div>
    </div>
  </div>
)
