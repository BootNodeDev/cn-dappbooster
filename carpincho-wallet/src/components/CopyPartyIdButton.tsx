import { PLAIN_ICON_BUTTON_CLASS } from '@/components/ui/Button'
import { COPY_ICON } from '@/components/ui/icons'
import { copyPartyId } from '@/utils/clipboard'
import { cn } from '@/utils/cn'

interface CopyPartyIdButtonProps {
  partyId: string
}

// Inline copy button used in the address row; pointer-events restored so it stays clickable
// inside pointer-events-none row wrappers.
export const CopyPartyIdButton = ({ partyId }: CopyPartyIdButtonProps): JSX.Element => (
  <button
    type="button"
    data-testid="account-copy-party-id"
    onClick={() => copyPartyId(partyId)}
    aria-label="Copy party ID"
    className={cn(PLAIN_ICON_BUTTON_CLASS, 'pointer-events-auto size-6 shrink-0')}
  >
    {COPY_ICON}
  </button>
)
