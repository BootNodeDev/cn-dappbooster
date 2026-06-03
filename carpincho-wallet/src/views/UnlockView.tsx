import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { PrimaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { toast } from '@/components/ui/toast'
import { WelcomeHero } from '@/components/WelcomeHero'
import { useVault } from '@/vault/useVault'

export const UnlockView = (): JSX.Element => {
  const v = useVault()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

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

  const onReset = (): void => {
    const ok = window.confirm(
      'This wipes the vault from this browser. If you have not exported your private keys, your accounts will be unrecoverable. Continue?',
    )
    if (ok) {
      v.destroyVault()
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
          className="block w-full mt-5 py-2 px-2 text-[0.85rem] bg-transparent border-0 text-muted-foreground font-semibold tracking-wide hover:text-danger transition-colors"
          onClick={onReset}
        >
          Forgot password? Reset vault
        </button>
      </Card>
    </div>
  )
}
