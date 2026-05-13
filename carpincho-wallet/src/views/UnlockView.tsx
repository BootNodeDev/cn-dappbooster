import { useState } from 'react'
import { CarpinchoLogo } from '../components/CarpinchoLogo.js'
import { useVault } from '../vault/useVault.js'

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
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const onReset = (): void => {
    const ok = window.confirm(
      'This wipes the vault from this browser. If you have not exported your private keys, your accounts will be unrecoverable. Continue?'
    )
    if (ok) {
      v.destroyVault()
    }
  }

  return (
    <div className="app-shell">
      <div className="hero-wrap">
        <CarpinchoLogo size={120} />
        <div className="hero-wordmark">Carpincho Wallet</div>
        <h2>Unlock</h2>
        <p className="muted">Enter your vault password to continue.</p>
      </div>
      <div className="card-soft">
        <form onSubmit={onSubmit}>
          <div className="mb-3">
            <label htmlFor="pw">Password</label>
            <input
              id="pw"
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
            />
          </div>
          {error !== undefined && <div className="error-box mb-3">{error}</div>}
          <button type="submit" className="btn btn-arg w-100 mb-2" disabled={busy || password === ''}>
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </form>
        <button type="button" className="btn btn-link btn-sm text-danger w-100 mt-2" onClick={onReset}>
          Forgot password? Reset vault
        </button>
      </div>
    </div>
  )
}
