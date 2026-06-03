import { toast } from '@/components/ui/toast'

export const copyPartyId = (partyId: string): void => {
  void navigator.clipboard
    .writeText(partyId)
    .then(() => toast.success('Party ID copied'))
    .catch((err: Error) => toast.error(`Copy failed: ${err.message}`))
}
