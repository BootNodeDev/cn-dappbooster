import { useSignMessage } from 'canton-connect-kit'
import { useState } from 'react'
import { toast } from 'sonner'
import { shortenIdentifier } from '../../utils/formatPartyId.js'
import './sign-message.css'

// CIP-0103 signMessage demo. Removable feature: delete this folder + its import
// and <SignMessageDemo /> line in App.tsx (see README "Removing a feature").
export const SignMessageDemo = (): JSX.Element => {
  const { signMessage, signature, isSigning } = useSignMessage()
  const [signInput, setSignInput] = useState<string>('hello canton')

  const onSignMessage = async (): Promise<void> => {
    try {
      await signMessage(signInput)
      toast.success('Message signed.')
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  return (
    <section className="workspace-panel ui-hidden" data-testid="signing-panel">
      <div className="panel-title-row">
        <div>
          <span className="section-kicker">Wallet capability</span>
          <h2>Sign message</h2>
        </div>
      </div>
      <div className="capability-card">
        <p>
          Exercises CIP-0103 <code>signMessage</code> against the connected wallet. The wallet asks
          for approval, signs with the active party's key, and returns the Ed25519 signature in
          base64. Useful for "prove you own this party" challenges from a backend.
        </p>
        <input
          type="text"
          data-testid="sign-input"
          value={signInput}
          onChange={(event) => setSignInput(event.target.value)}
          placeholder="Message to sign"
          disabled={isSigning}
        />
        <button
          data-testid="sign-message"
          type="button"
          onClick={() => {
            void onSignMessage()
          }}
          disabled={isSigning}
        >
          Sign with active party
        </button>
        {signature !== undefined && (
          <div data-testid="signature-output" data-signature={signature}>
            <span className="kicker">Signature (base64)</span>
            <code>{shortenIdentifier(signature)}</code>
          </div>
        )}
      </div>
    </section>
  )
}
