import { useState } from 'react'
import { AccountRow } from '@/components/AccountRow'
import { AccountsDialog } from '@/components/AccountsDialog'
import { CopyPartyIdButton } from '@/components/CopyPartyIdButton'
import { PrimaryButton } from '@/components/ui/Button'
import { CHEVRON_DOWN_ICON } from '@/components/ui/icons'
import type { AccountPublic } from '@/vault/types'

interface AccountCardProps {
  primary: AccountPublic | undefined
}

// The whole card opens the Accounts popup; the inline copy button stays independent of that action.
export const AccountCard = ({ primary }: AccountCardProps): React.JSX.Element => {
  const [accountsOpen, setAccountsOpen] = useState(false)

  return (
    <section className="group relative border border-border rounded-lg bg-surface p-2.5">
      {primary === undefined ? (
        <div className="py-3 text-center">
          <div className="font-display text-[1.4rem] font-semibold text-foreground mb-1">
            No account yet
          </div>
          <p className="text-soft text-[0.98rem] mb-4">
            Create your first Canton party to start signing.
          </p>
          <PrimaryButton
            className="w-full"
            data-testid="home-create-account"
            onClick={() => setAccountsOpen(true)}
          >
            Finish
          </PrimaryButton>
        </div>
      ) : (
        <>
          <button
            type="button"
            data-testid="home-active-account"
            data-party-id={primary.partyId}
            onClick={() => setAccountsOpen(true)}
            aria-label="Open account menu"
            className="absolute inset-0 z-0 rounded-lg outline-none transition-colors group-hover:bg-primary-soft/60 focus-visible:shadow-focus"
          />
          <div className="pointer-events-none relative z-10 flex w-full items-center gap-2">
            <AccountRow
              account={primary}
              avatarSize="sm"
              addressTrailing={<CopyPartyIdButton partyId={primary.partyId} />}
            />
            <span
              aria-hidden="true"
              className="mx-0.5 -my-2.5 w-px shrink-0 self-stretch bg-border"
            />
            <span
              aria-hidden="true"
              className="grid size-8 shrink-0 place-items-center text-muted-foreground"
            >
              {CHEVRON_DOWN_ICON}
            </span>
          </div>
        </>
      )}
      <AccountsDialog
        open={accountsOpen}
        onOpenChange={setAccountsOpen}
      />
    </section>
  )
}
