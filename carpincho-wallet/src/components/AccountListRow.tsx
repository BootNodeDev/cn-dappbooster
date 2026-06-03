import { AccountRow } from '@/components/AccountRow'
import { PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { COPY_ICON, TRASH_ICON } from '@/components/ui/icons'
import { StatusDot } from '@/components/ui/StatusDot'
import { copyPartyId } from '@/utils/clipboard'
import { cn } from '@/utils/cn'
import type { AccountPublic } from '@/vault/types'

// The remove affordance tints only its icon red on hover (no button-background change), matching the
// inline copy button.
const REMOVE_BUTTON_CLASS =
  'relative z-10 inline-grid size-8 shrink-0 place-items-center rounded-sm ' +
  'text-muted-foreground transition-colors hover:text-danger ' +
  'focus-visible:outline-none focus-visible:shadow-focus'

interface AccountListRowProps {
  account: AccountPublic
  canRemove: boolean
  onSelect: () => void
  onRequestRemove: () => void
}

// One account entry in the Accounts popup. A full-row button sits behind the content and selects the
// account, while the inline copy button (beside the address) and the remove button sit above it so
// their clicks stay independent of selection. The remove button is omitted when only one account
// exists.
export const AccountListRow = ({
  account,
  canRemove,
  onSelect,
  onRequestRemove,
}: AccountListRowProps): JSX.Element => (
  <div
    className={cn(
      'relative flex w-full items-center gap-1 rounded-sm transition-colors',
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
      className="absolute inset-0 z-0 rounded-sm outline-none transition-colors hover:bg-primary-soft focus-visible:shadow-focus"
    />
    <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-2 p-2">
      <AccountRow
        account={account}
        withName
        nameTrailing={<StatusDot active={account.isPrimary} />}
        addressTrailing={
          <button
            type="button"
            data-testid="account-copy-party-id"
            onClick={() => copyPartyId(account.partyId)}
            aria-label="Copy party ID"
            className={cn(PLAIN_ICON_BUTTON_CLASS, 'pointer-events-auto size-6 shrink-0')}
          >
            {COPY_ICON}
          </button>
        }
      />
    </div>
    {canRemove && (
      <button
        type="button"
        data-testid="account-remove"
        onClick={onRequestRemove}
        aria-label={`Remove ${account.name}`}
        className={REMOVE_BUTTON_CLASS}
      >
        {TRASH_ICON}
      </button>
    )}
  </div>
)
