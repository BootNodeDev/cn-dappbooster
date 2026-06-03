import { AccountRow } from '@/components/AccountRow'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { COPY_ICON, TRASH_ICON } from '@/components/ui/icons'
import { StatusDot } from '@/components/ui/StatusDot'
import { copyPartyId } from '@/utils/clipboard'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

interface AccountListRowProps {
  account: AccountPublic
  canRemove: boolean
  onSelect: () => void
  onRequestRemove: () => void
}

// One account entry in the Accounts popup: a clickable identity (selects the account), an
// independent copy action, the active-status dot, and a remove action that the parent gates behind
// a confirmation dialog. The remove button is omitted when only one account exists.
export const AccountListRow = ({
  account,
  canRemove,
  onSelect,
  onRequestRemove,
}: AccountListRowProps): JSX.Element => (
  <div
    className={cn(
      'flex w-full items-center gap-1 rounded-sm transition-colors',
      account.isPrimary && 'bg-primary-soft/40',
    )}
  >
    <button
      type="button"
      data-testid="account-item"
      data-party-id={account.partyId}
      aria-current={account.isPrimary ? true : undefined}
      aria-label={account.name}
      onClick={onSelect}
      className="flex min-w-0 flex-1 items-center gap-2 rounded-sm p-2 text-left outline-none transition-colors hover:bg-primary-soft focus-visible:shadow-focus"
    >
      <AccountRow
        account={account}
        withName
      />
    </button>
    <button
      type="button"
      data-testid="account-copy-party-id"
      onClick={() => copyPartyId(account.partyId)}
      aria-label="Copy party ID"
      className={cn(ICON_BUTTON_CLASS, 'size-8 shrink-0 rounded-sm')}
    >
      {COPY_ICON}
    </button>
    <StatusDot active={account.isPrimary} />
    {canRemove && (
      <button
        type="button"
        data-testid="account-remove"
        onClick={onRequestRemove}
        aria-label={`Remove ${account.name}`}
        className={cn(
          ICON_BUTTON_CLASS,
          'size-8 shrink-0 rounded-sm enabled:hover:bg-danger/10 enabled:hover:text-danger',
        )}
      >
        {TRASH_ICON}
      </button>
    )}
  </div>
)
