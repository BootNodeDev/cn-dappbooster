import { toast } from '@/components/ui/toast'

// How long a copied secret may sit on the clipboard before we try to wipe it.
const SECRET_CLIPBOARD_CLEAR_MS = 60_000

// Copies arbitrary wallet text while keeping success and failure feedback consistent.
// onSuccess runs only after a successful copy (used to schedule a secret wipe).
export const copyText = (value: string, successMessage: string, onSuccess?: () => void): void => {
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(successMessage)
      onSuccess?.()
    })
    .catch((err: Error) => toast.error(`Copy failed: ${err.message}`))
}

// Best-effort clipboard wipe: only clears if the clipboard still holds the secret,
// so we never clobber whatever the user copied afterwards. Silently skips when the
// browser denies clipboard reads (no extra permission is requested).
const scheduleSecretClear = (secret: string): void => {
  const handle = setTimeout(() => {
    void (async () => {
      try {
        if ((await navigator.clipboard.readText()) === secret) {
          await navigator.clipboard.writeText('')
        }
      } catch {
        // readText unavailable or denied: leave the clipboard untouched.
      }
    })()
  }, SECRET_CLIPBOARD_CLEAR_MS)
  // Don't keep a Node event loop (tests) alive waiting on the wipe; harmless in the browser.
  ;(handle as unknown as { unref?: () => void }).unref?.()
}

// Copies a sensitive value (e.g. a private key) and schedules a best-effort clipboard wipe.
export const copySecret = (value: string, successMessage: string): void => {
  copyText(value, successMessage, () => scheduleSecretClear(value))
}

// Copies a party id from account surfaces with a domain-specific confirmation.
export const copyPartyId = (partyId: string): void => {
  copyText(partyId, 'Party ID copied')
}
