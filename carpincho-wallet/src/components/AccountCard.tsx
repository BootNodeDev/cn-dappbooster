import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { AccountRow } from '@/components/AccountRow.tsx'
import { ICON_BUTTON_CLASS, PrimaryButton } from '@/components/ui/Button.tsx'
import { COPY_ICON } from '@/components/ui/icons.tsx'
import { cn } from '@/utils/cn.ts'
import type { AccountPublic } from '@/vault/types.ts'

interface AccountCardProps {
  primary: AccountPublic | undefined
  accountsSorted: AccountPublic[]
  onSelectAccount: (id: string) => void
  onAddAccount: () => void
  onCopyPartyId: (partyId: string) => void
}

interface AccountMenuMetrics {
  width: number | undefined
  alignOffset: number
}

// Renders the current account summary and keeps the account switcher menu aligned with that card.
export const AccountCard = ({
  primary,
  accountsSorted,
  onSelectAccount,
  onAddAccount,
  onCopyPartyId,
}: AccountCardProps): JSX.Element => {
  const accountSectionRef = useRef<HTMLElement>(null)
  const accountMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [accountMenuMetrics, setAccountMenuMetrics] = useState<AccountMenuMetrics>({
    width: undefined,
    alignOffset: 0,
  })

  // Measures both card and caret so the full-width menu aligns to the card, not the icon trigger.
  const syncAccountMenuMetrics = useCallback((): void => {
    const accountSection = accountSectionRef.current

    if (accountSection === null) {
      return
    }

    const sectionRect = accountSection.getBoundingClientRect()
    const triggerRect = accountMenuTriggerRef.current?.getBoundingClientRect()
    const nextWidth = sectionRect.width
    const nextAlignOffset = triggerRect === undefined ? 0 : triggerRect.right - sectionRect.right

    if (nextWidth <= 0) {
      return
    }

    setAccountMenuMetrics((currentMetrics) =>
      currentMetrics.width === nextWidth && currentMetrics.alignOffset === nextAlignOffset
        ? currentMetrics
        : { width: nextWidth, alignOffset: nextAlignOffset },
    )
  }, [])

  // Refreshes layout metrics immediately before Radix positions the menu on open.
  const handleAccountMenuOpenChange = useCallback(
    (open: boolean): void => {
      setAccountMenuOpen(open)

      if (open) {
        syncAccountMenuMetrics()
      }
    },
    [syncAccountMenuMetrics],
  )

  useLayoutEffect(() => {
    // No primary account means no trigger or menu is rendered, so there is nothing to measure.
    if (primary === undefined) {
      return undefined
    }

    const accountSection = accountSectionRef.current

    if (accountSection === null) {
      return undefined
    }

    syncAccountMenuMetrics()

    if (typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const resizeObserver = new ResizeObserver(syncAccountMenuMetrics)
    resizeObserver.observe(accountSection)

    return () => {
      resizeObserver.disconnect()
    }
  }, [primary, syncAccountMenuMetrics])

  return (
    <section
      ref={accountSectionRef}
      className="relative overflow-hidden border border-border rounded-lg bg-surface p-2.5"
    >
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
          <div className="flex w-full items-center gap-2">
            <AccountRow account={primary} />
            <button
              type="button"
              data-testid="account-copy-party-id"
              onClick={() => onCopyPartyId(primary.partyId)}
              aria-label="Copy party ID"
              className={cn(ICON_BUTTON_CLASS, 'size-8 shrink-0 rounded-sm text-muted-foreground')}
            >
              {COPY_ICON}
            </button>
            <DropdownMenu.Root onOpenChange={handleAccountMenuOpenChange}>
              <DropdownMenu.Trigger asChild>
                <button
                  ref={accountMenuTriggerRef}
                  className={cn(
                    ICON_BUTTON_CLASS,
                    'size-8 shrink-0 rounded-sm text-muted-foreground transition-colors',
                  )}
                  data-testid="home-active-account"
                  data-party-id={primary.partyId}
                  type="button"
                  aria-label="Open account menu"
                >
                  <span
                    data-testid="account-menu-caret"
                    className={cn(
                      'size-[10px] border-r-2 border-b-2 border-current transition-transform duration-200 ease-out',
                      accountMenuOpen ? 'rotate-45' : 'rotate-[-45deg]',
                    )}
                    aria-hidden="true"
                  />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  alignOffset={accountMenuMetrics.alignOffset}
                  sideOffset={8}
                  style={{ width: accountMenuMetrics.width }}
                  className="z-[12] p-2 border border-border-strong rounded-lg bg-surface shadow-popover data-[state=open]:animate-slide-down-and-fade"
                >
                  <div className="font-mono text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground px-2 pt-1 pb-2">
                    Accounts
                  </div>
                  {accountsSorted.map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        'group/item relative flex w-full items-center gap-1 rounded-sm transition-colors',
                        a.isPrimary &&
                          'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-[3px] before:rounded-full before:bg-primary',
                      )}
                    >
                      <DropdownMenu.Item
                        data-testid="account-item"
                        data-party-id={a.partyId}
                        onSelect={() => onSelectAccount(a.id)}
                        aria-label={a.name}
                        aria-current={a.isPrimary ? true : undefined}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-sm p-2 text-foreground text-left outline-none cursor-pointer transition-colors data-[highlighted]:bg-primary-soft"
                      >
                        <AccountRow account={a} />
                        {a.isPrimary && (
                          <span className="shrink-0 font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-primary">
                            active
                          </span>
                        )}
                      </DropdownMenu.Item>
                      <button
                        type="button"
                        data-testid="account-copy-party-id"
                        onClick={() => onCopyPartyId(a.partyId)}
                        aria-label="Copy party ID"
                        className={cn(
                          ICON_BUTTON_CLASS,
                          'size-8 shrink-0 rounded-sm text-muted-foreground',
                        )}
                      >
                        {COPY_ICON}
                      </button>
                    </div>
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
}
