import { AccountRow } from '@/components/AccountRow'
import type { AccountPublic } from '@/vault/types'

export interface ContactsPickerProps {
  contacts: AccountPublic[]
  onSelect: (partyId: string) => void
}

// Fixed height for ~4 rows so a longer list scrolls rather than resizing the sheet.
const LIST_CLASS = 'flex h-[13rem] flex-col gap-1 overflow-y-auto'

export const ContactsPicker = ({ contacts, onSelect }: ContactsPickerProps): JSX.Element => {
  if (contacts.length === 0) {
    return (
      <p className="px-2 py-6 text-center text-[0.92rem] text-muted-foreground">
        No other accounts to send to. Add another account to build your contacts.
      </p>
    )
  }
  return (
    <div className={LIST_CLASS}>
      {contacts.map((account) => (
        <button
          key={account.id}
          type="button"
          aria-label={account.name}
          onClick={() => onSelect(account.partyId)}
          className="flex items-center rounded-sm p-2 text-left outline-none transition-colors hover:bg-primary-soft focus-visible:shadow-focus"
        >
          <AccountRow
            account={account}
            withName
          />
        </button>
      ))}
    </div>
  )
}
