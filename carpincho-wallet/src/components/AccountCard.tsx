import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AccountAvatar } from '@/components/ui/AccountAvatar.tsx'
import { ICON_BUTTON_CLASS, PrimaryButton } from '@/components/ui/Button.tsx'
import { COPY_ICON } from '@/components/ui/icons.tsx'
import { shortMiddle } from '@/utils/account.ts'
import { cn } from '@/utils/cn.ts'
import type { AccountPublic } from '@/vault/types.ts'

interface AccountCardProps {
  primary: AccountPublic | undefined
  accountsSorted: AccountPublic[]
  onSelectAccount: (id: string) => void
  onAddAccount: () => void
  onCopyPartyId: (partyId: string) => void
}

export const AccountCard = ({
  primary,
  accountsSorted,
  onSelectAccount,
  onAddAccount,
  onCopyPartyId,
}: AccountCardProps): JSX.Element => (
  <section className="relative overflow-hidden border border-border rounded-lg bg-surface p-2.5">
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 h-14 bg-[linear-gradient(180deg,var(--color-primary-soft)_0%,transparent_100%)] opacity-70 pointer-events-none"
    />
    <div className="relative z-[1]">
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
            onClick={onAddAccount}
          >
            Create account
          </PrimaryButton>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <AccountAvatar
            name={primary.name}
            partyId={primary.partyId}
          />
          <div className="min-w-0 flex-1">
            <span className="block truncate font-mono text-[0.9rem] font-semibold text-foreground">
              {shortMiddle(primary.partyId, 12, 7)}
            </span>
          </div>
          <button
            type="button"
            data-testid="home-copy-party-id"
            onClick={() => onCopyPartyId(primary.partyId)}
            aria-label="Copy party ID"
            className={cn(ICON_BUTTON_CLASS, 'size-8 rounded-sm text-muted-foreground')}
          >
            {COPY_ICON}
          </button>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className={cn(
                  ICON_BUTTON_CLASS,
                  'size-8 rounded-sm text-muted-foreground transition-colors',
                )}
                data-testid="home-active-account"
                data-party-id={primary.partyId}
                type="button"
                aria-label="Open account menu"
              >
                <span
                  className="size-[10px] border-r-2 border-b-2 border-current transition-transform duration-200 ease-out rotate-[-45deg] data-[state=open]:rotate-45"
                  aria-hidden="true"
                />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-[12] w-64 p-2 border border-border-strong rounded-lg bg-surface shadow-popover data-[state=open]:animate-slide-down-and-fade"
              >
                <div className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground px-2 pt-1 pb-2">
                  Accounts
                </div>
                {accountsSorted.map((a) => (
                  <DropdownMenu.Item
                    key={a.id}
                    data-testid="account-item"
                    data-party-id={a.partyId}
                    onSelect={() => onSelectAccount(a.id)}
                    className={cn(
                      'group/item relative w-full flex items-center gap-2.5 rounded-sm p-2 text-foreground text-left outline-none cursor-pointer transition-colors',
                      'data-[highlighted]:bg-primary-soft',
                      a.isPrimary &&
                        'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary',
                    )}
                  >
                    <AccountAvatar
                      name={a.name}
                      partyId={a.partyId}
                    />
                    <span className="flex flex-1 min-w-0 flex-col">
                      <strong className="truncate text-[1rem] font-semibold tracking-tight">
                        {a.name}
                      </strong>
                      <small className="text-muted-foreground text-[0.82rem] font-mono font-medium">
                        {shortMiddle(a.partyId, 14, 7)}
                      </small>
                    </span>
                    {a.isPrimary && (
                      <span className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
                        active
                      </span>
                    )}
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Item
                  data-testid="menu-add-account"
                  onSelect={onAddAccount}
                  className="w-full flex justify-center items-center gap-2 border border-dashed border-border rounded-sm p-2 text-primary font-semibold mt-2 outline-none cursor-pointer transition-colors data-[highlighted]:bg-primary-soft data-[highlighted]:border-primary/40"
                >
                  <span aria-hidden="true">+</span> Add account
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      )}
    </div>
  </section>
)
