import { useState } from 'react'
import { completeCreateParty, prepareCreateParty } from '@/api/walletService.ts'
import { Alert } from '@/components/ui/Alert.tsx'
import { PrimaryButton, SecondaryButton } from '@/components/ui/Button.tsx'
import { TextInput } from '@/components/ui/TextInput.tsx'
import { toast } from '@/components/ui/toast.ts'
import { generateKeypair, signMessageBase64 } from '@/vault/keypair.ts'
import { useVault } from '@/vault/useVault.ts'
import { getCantonNetwork } from '@/wc/client.ts'

export interface CreateAccountFormProps {
  onSuccess?: () => void
  onCancel?: () => void
  submitLabel?: string
}

export const CreateAccountForm = ({
  onSuccess,
  onCancel,
  submitLabel = 'Create account',
}: CreateAccountFormProps): JSX.Element => {
  const v = useVault()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(undefined)
    const trimmed = name.trim().toLowerCase()
    if (!/^[a-z0-9._-]{3,64}$/.test(trimmed)) {
      setError('Use 3–64 lowercase letters, digits, dot, dash, or underscore.')
      return
    }
    setBusy(true)
    try {
      const kp = await generateKeypair()
      const prepared = await prepareCreateParty({
        publicKeyBase64: kp.publicKeyBase64,
        partyHint: trimmed,
      })
      const signatureBase64 = await signMessageBase64(kp.privateKeyHex, prepared.multiHash)
      const completed = await completeCreateParty({
        onboardingId: prepared.onboardingId,
        signatureBase64,
      })
      await v.addAccount({
        name: trimmed,
        partyId: completed.partyId,
        network: getCantonNetwork(),
        privateKeyHex: kp.privateKeyHex,
        publicKeyBase64: kp.publicKeyBase64,
      })
      onSuccess?.()
    } catch (err) {
      toast.error(`Create account failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 pt-1">
      <p className="text-soft text-[1rem] m-0 leading-relaxed">
        Generates a fresh ed25519 keypair and creates a Canton external party through the
        wallet-service.
      </p>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-4"
      >
        <div>
          <label htmlFor="acct-name">Username / party hint</label>
          <TextInput
            id="acct-name"
            type="text"
            className="font-mono"
            data-testid="add-account-hint-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="alice"
            maxLength={64}
          />
        </div>
        {error !== undefined && <Alert variant="error">{error}</Alert>}
        <div className="flex gap-3 mt-1">
          <PrimaryButton
            type="submit"
            data-testid="add-account-submit"
            disabled={busy || name.trim() === ''}
          >
            {busy ? 'Creating…' : submitLabel}
          </PrimaryButton>
          {onCancel !== undefined && (
            <SecondaryButton
              onClick={onCancel}
              data-testid="add-account-cancel"
              disabled={busy}
            >
              Cancel
            </SecondaryButton>
          )}
        </div>
      </form>
    </div>
  )
}
