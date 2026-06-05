import { toast } from '@/components/ui/toast'
import { errorMessage } from './errorMessage'

// Write text to the clipboard, surfacing failures as an error toast. On success
// either show a toast (when passed a string) or run a custom handler.
export const copyToClipboard = async (
  text: string,
  onSuccess: string | (() => void),
): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text)
    if (typeof onSuccess === 'string') {
      toast.success(onSuccess)
    } else {
      onSuccess()
    }
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
