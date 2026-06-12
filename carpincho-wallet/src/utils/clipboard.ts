import { toast } from '@/components/ui/toast'

// Copies arbitrary wallet text while keeping success and failure feedback consistent.
export const copyText = (value: string, successMessage: string): void => {
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success(successMessage))
    .catch((err: Error) => toast.error(`Copy failed: ${err.message}`))
}

// Copies a party id from account surfaces with a domain-specific confirmation.
export const copyPartyId = (partyId: string): void => {
  copyText(partyId, 'Party ID copied')
}
