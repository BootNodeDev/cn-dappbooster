import { toast } from '@/components/toast'

// Copy a party id to the clipboard with success/error toasts. Shared by the
// grant views and the wallet switcher.
export const copyPartyId = async (partyId: string): Promise<void> => {
  try {
    await navigator.clipboard.writeText(partyId)
    toast.success('Party id copied')
  } catch {
    toast.error('Could not copy')
  }
}
