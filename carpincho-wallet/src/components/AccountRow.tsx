import { AccountAvatar } from '@/components/ui/AccountAvatar'
import { shortMiddle } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'

interface AccountRowProps {
  account: AccountPublic
}

// Renders the shared account identity (avatar + truncated party id) reused by the active account row
// and the account menu entries. The full account name is surfaced via the party id's title attribute
// and the menu item's aria-label so it stays available for disambiguation without crowding the row.
export const AccountRow = ({ account }: AccountRowProps): JSX.Element => (
  <div className="flex min-w-0 flex-1 items-center gap-2">
    <AccountAvatar
      name={account.name}
      partyId={account.partyId}
    />
    <div className="min-w-0 flex-1">
      <span
        title={account.name}
        className="block truncate font-mono text-[0.9rem] font-semibold text-foreground"
      >
        {shortMiddle(account.partyId, 12, 7)}
      </span>
    </div>
  </div>
)
