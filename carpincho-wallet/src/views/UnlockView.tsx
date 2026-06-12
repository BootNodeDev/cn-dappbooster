import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { DangerConfirm } from '@/components/ui/DangerConfirm'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/toast'
import { WelcomeHero } from '@/components/WelcomeHero'
import { useVault } from '@/vault/useVault'

export const UnlockView = (): React.JSX.Element => {
  const v = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [resetOpen, setResetOpen] = useState(false)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(undefined)
    setBusy(true)
    try {
      await v.unlock(password)
    } catch (err) {
      const message = (err as Error).message
      if (message === 'invalid password') {
        setError('Incorrect password.')
      } else {
        toast.error(`Unlock failed: ${message}`)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <WelcomeHero
        logoSize={112}
        description="Enter your vault password to continue."
      />
      <Card>
        <h2 className="m-0 mb-4 font-display text-[1.55rem] font-semibold text-foreground tracking-[-0.02em] leading-tight">
          Welcome back
        </h2>
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
        >
          <div>
            <label htmlFor="pw">Password</label>
            <PasswordInput
              id="pw"
              data-testid="unlock-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error !== undefined && <Alert variant="error">{error}</Alert>}
          <PrimaryButton
            type="submit"
            data-testid="unlock-submit"
            className="w-full"
            disabled={busy || password === ''}
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </PrimaryButton>
        </form>
        <button
          type="button"
          data-testid="reset-vault-trigger"
          className="block w-full mt-5 py-2 px-2 text-[0.85rem] bg-transparent border-0 text-muted-foreground font-semibold tracking-wide hover:text-danger transition-colors"
          onClick={() => setResetOpen(true)}
        >
          Forgot password? Reset vault
        </button>
      </Card>
      <Sheet
        open={resetOpen}
        onOpenChange={setResetOpen}
        side="center"
        title="Reset vault"
        description="Wipe this vault from the browser."
      >
        <DangerConfirm
          testId="reset-vault"
          message={
            <>
              This wipes the vault from this browser. If you have not exported your private keys,
              your accounts will be{' '}
              <span className="font-semibold text-foreground">unrecoverable</span>.
            </>
          }
          note="This cannot be undone."
          confirmLabel="Reset vault"
          confirmTestId="confirm-reset-vault"
          onConfirm={() => v.destroyVault()}
        />
      </Sheet>
    </div>
  )
}
