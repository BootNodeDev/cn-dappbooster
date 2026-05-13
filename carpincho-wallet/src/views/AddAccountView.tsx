import { useState } from 'react'
import { useVault } from '../vault/useVault.js'
import { generateKeypair, signMessageBase64 } from '../vault/keypair.js'
import { getCantonNetwork } from '../wc/client.js'
import { walletServiceRequest } from '../api/walletService.js'

export interface AddAccountViewProps {
  onClose: () => void
}

export const AddAccountView = ({ onClose }: AddAccountViewProps): JSX.Element => {
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
      const prepared = await walletServiceRequest<{
        onboardingId: string
        partyId: string
        multiHash: string
      }>('prepareCreateParty', {
        publicKeyBase64: kp.publicKeyBase64,
        partyHint: trimmed
      })
      const signatureBase64 = await signMessageBase64(kp.privateKeyHex, prepared.multiHash)
      const completed = await walletServiceRequest<{
        partyId: string
      }>('completeCreateParty', {
        onboardingId: prepared.onboardingId,
        signatureBase64
      })
      await v.addAccount({
        name: trimmed,
        partyId: completed.partyId,
        network: getCantonNetwork(),
        privateKeyHex: kp.privateKeyHex,
        publicKeyBase64: kp.publicKeyBase64
      })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card-soft mb-3">
      <h5>Add account</h5>
      <p className="locked-note mb-3">
        Generates a fresh ed25519 keypair and creates a Canton external party through the wallet-service.
      </p>
      <form onSubmit={onSubmit}>
        <div className="mb-2">
          <label htmlFor="acct-name">Username / party hint</label>
          <input
            id="acct-name"
            type="text"
            className="form-control"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            placeholder="alice"
            maxLength={64}
          />
        </div>
        {error !== undefined && <div className="error-box mb-2">{error}</div>}
        <div className="d-flex gap-2">
          <button type="submit" className="btn btn-arg" disabled={busy || name.trim() === ''}>
            {busy ? 'Creating...' : 'Create account'}
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
