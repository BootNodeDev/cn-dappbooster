import { type MouseEvent, type PointerEvent, type ReactNode, useCallback } from 'react'
import { AccountAvatar } from '@/components/ui/AccountAvatar.tsx'
import { ICON_BUTTON_CLASS } from '@/components/ui/Button.tsx'
import { COPY_ICON } from '@/components/ui/icons.tsx'
import { shortMiddle } from '@/utils/account.ts'
import { cn } from '@/utils/cn.ts'
import type { AccountPublic } from '@/vault/types.ts'

interface AccountRowProps {
  account: AccountPublic
  onCopyPartyId: (partyId: string) => void
  className?: string
  trailingAction?: ReactNode
}

// Renders the shared account identity row used by the active account and account menu entries.
export const AccountRow = ({
  account,
  onCopyPartyId,
  className,
  trailingAction,
}: AccountRowProps): JSX.Element => {
  // Copies the party id without letting parent menu rows treat the copy button as account selection.
  const handleCopyPartyId = useCallback(
    (event: MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault()
      event.stopPropagation()
      onCopyPartyId(account.partyId)
    },
    [account.partyId, onCopyPartyId],
  )

  // Keeps pointer activation on the copy button from bubbling into Radix menu item selection.
  const stopCopyPointerSelection = useCallback((event: PointerEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
  }, [])

  return (
    <div className={cn('flex w-full items-center gap-2', className)}>
      <AccountAvatar
        name={account.name}
        partyId={account.partyId}
      />
      <div className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[0.9rem] font-semibold text-foreground">
          {shortMiddle(account.partyId, 12, 7)}
        </span>
      </div>
      <button
        type="button"
        data-testid="account-copy-party-id"
        onClick={handleCopyPartyId}
        onPointerDown={stopCopyPointerSelection}
        onPointerUp={stopCopyPointerSelection}
        aria-label="Copy party ID"
        className={cn(ICON_BUTTON_CLASS, 'size-8 rounded-sm text-muted-foreground')}
      >
        {COPY_ICON}
      </button>
      {trailingAction}
    </div>
  )
}
