import { useMemo, useState } from 'react'
import { AccountListRow } from '@/components/AccountListRow'
import { CreateAccountForm } from '@/components/CreateAccountForm'
import { PrimaryButton } from '@/components/ui/Button'
import { SEARCH_ICON, X_ICON } from '@/components/ui/icons'
import { Sheet } from '@/components/ui/Sheet'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { sortAccounts } from '@/utils/account'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

interface AccountsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const REMOVE_BUTTON_CLASS =
  'w-full border-danger bg-danger ' +
  'enabled:hover:border-danger enabled:hover:shadow-none enabled:hover:before:opacity-0'

// Centered account switcher: one popup with three in-place screens (list, add form, remove confirm)
// backed by the vault. Transient state resets on close.
export const AccountsDialog = ({ open, onOpenChange }: AccountsDialogProps): JSX.Element => {
  const v = useVault()
  const [screen, setScreen] = useState<'list' | 'add'>('list')
  const [query, setQuery] = useState('')
  const [removeTarget, setRemoveTarget] = useState<AccountPublic | null>(null)

  const sorted = useMemo(() => sortAccounts(v.accounts), [v.accounts])
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') {
      return sorted
    }
    return sorted.filter(
      (a) => a.name.toLowerCase().includes(q) || a.partyId.toLowerCase().includes(q),
    )
  }, [sorted, query])

  const isAdd = screen === 'add' && removeTarget === null

  const handleOpenChange = (next: boolean): void => {
    onOpenChange(next)
    if (!next) {
      setScreen('list')
      setQuery('')
      setRemoveTarget(null)
    }
  }

  const onSelect = (id: string): void => {
    void v.setPrimary(id)
    handleOpenChange(false)
  }

  const onConfirmRemove = (): void => {
    if (removeTarget === null) {
      return
    }
    const target = removeTarget
    setRemoveTarget(null)
    void v
      .removeAccount(target.id)
      .then(() => {
        setQuery('')
        toast.success('Account removed')
      })
      .catch((err: Error) => toast.error(`Remove failed: ${err.message}`))
  }

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      side="center"
      title={
        removeTarget !== null ? `Remove ${removeTarget.name}?` : isAdd ? 'Add account' : 'Accounts'
      }
      description={
        removeTarget !== null
          ? 'Confirm removing this account.'
          : isAdd
            ? 'Create a new Canton party.'
            : 'Switch, add, or remove accounts.'
      }
      onBack={isAdd ? () => setScreen('list') : undefined}
      hideClose={isAdd}
      onClose={removeTarget !== null ? () => setRemoveTarget(null) : undefined}
    >
      {removeTarget !== null ? (
        <div
          data-testid="remove-account"
          className="flex flex-col gap-4"
        >
          <div className="rounded-md border border-border bg-muted/50 px-3 py-2.5">
            <span className="block break-all font-mono text-[0.8rem] leading-relaxed text-foreground">
              {removeTarget.partyId}
            </span>
          </div>
          <p className="text-soft text-[0.95rem] leading-relaxed">
            <span className="font-semibold text-foreground">{removeTarget.name}</span> will be
            removed from this wallet.
          </p>
          <p className="font-semibold text-foreground">This cannot be undone.</p>
          <PrimaryButton
            className={REMOVE_BUTTON_CLASS}
            data-testid="confirm-remove-action"
            onClick={onConfirmRemove}
          >
            Remove
          </PrimaryButton>
        </div>
      ) : isAdd ? (
        <CreateAccountForm
          submitLabel="Create account"
          onSuccess={() => setScreen('list')}
        />
      ) : (
        <div
          data-testid="accounts-dialog"
          className="flex flex-col gap-3"
        >
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {SEARCH_ICON}
            </span>
            <TextInput
              type="text"
              data-testid="account-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your accounts"
              aria-label="Search your accounts"
              className="pl-9 pr-9 text-sm"
            />
            {query !== '' && (
              <button
                type="button"
                data-testid="account-search-clear"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 inline-grid size-6 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:shadow-focus"
              >
                {X_ICON}
              </button>
            )}
          </div>
          <div className="flex max-h-[300px] min-h-[300px] flex-col gap-1 overflow-y-auto">
            {/* Fixed height hints there are more rows and avoids layout shift while filtering. */}
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-[0.92rem] text-muted-foreground">
                No accounts match
              </p>
            ) : (
              filtered.map((a) => (
                <AccountListRow
                  key={a.id}
                  account={a}
                  canRemove={sorted.length > 1}
                  onSelect={() => onSelect(a.id)}
                  onRequestRemove={() => setRemoveTarget(a)}
                />
              ))
            )}
          </div>
          <button
            type="button"
            data-testid="menu-add-account"
            onClick={() => {
              setQuery('')
              setScreen('add')
            }}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-sm border border-dashed border-border p-2 font-semibold text-primary transition-colors hover:border-primary/40 hover:bg-primary-soft"
          >
            <span aria-hidden="true">+</span> Add account
          </button>
        </div>
      )}
    </Sheet>
  )
}
