import { useState } from 'react'
import { PrimaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import { pairWithUri } from '@/wc/client'

interface WalletConnectMenuProps {
  // Closes the drawer on success so HomeView's approval flow is visible.
  onPaired: () => void
}

export const WalletConnectMenu = ({ onPaired }: WalletConnectMenuProps): JSX.Element => {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)

  const onPair = async (): Promise<void> => {
    const uri = draft.trim()
    if (uri === '') {
      toast.warning('Paste a WalletConnect pairing URI first.')
      return
    }
    setBusy(true)
    try {
      await pairWithUri(uri)
      setDraft('')
      onPaired()
    } catch (err) {
      toast.error(`Pairing failed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        void onPair()
      }}
    >
      <p className="text-soft text-[0.9rem] leading-relaxed">Paste a WalletConnect URI</p>
      <TextInput
        className="w-full font-mono text-[0.92rem]"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="wc:..."
      />
      <PrimaryButton
        type="submit"
        className="w-full"
        disabled={busy || draft.trim() === ''}
      >
        {busy ? 'Pairing…' : 'Connect'}
      </PrimaryButton>
    </form>
  )
}
