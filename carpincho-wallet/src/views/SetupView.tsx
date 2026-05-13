import { useState } from 'react'
import { CarpinchoLogo } from '../components/CarpinchoLogo.js'
import { useVault } from '../vault/useVault.js'

export const SetupView = (): JSX.Element => {
  const v = useVault()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(undefined)
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    try {
      await v.setup(password)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="app-shell">
      <div className="hero-wrap">
        <CarpinchoLogo size={140} />
        <div className="hero-wordmark">Carpincho Wallet</div>
        <h2>Welcome</h2>
        <p className="muted">
          A Canton wallet built like a real wallet: your keys live in this
          browser, encrypted with a password only you know.
        </p>
      </div>
      <div className="card-soft">
        <p className="locked-note mb-3">
          Pick a password. We&apos;ll use it to encrypt your private keys
          locally with AES-GCM. There&apos;s no recovery — write it down.
        </p>
        <form onSubmit={onSubmit}>
          <div className="mb-2">
            <label htmlFor="pw">New password</label>
            <input
              id="pw"
              type="password"
              className="form-control"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={8}
              autoFocus
              autoComplete="new-password"
            />
          </div>
          <div className="mb-3">
            <label htmlFor="pw2">Confirm password</label>
            <input
              id="pw2"
              type="password"
              className="form-control"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {error !== undefined && <div className="error-box mb-3">{error}</div>}
          <button type="submit" className="btn btn-arg w-100" disabled={busy}>
            {busy ? 'Encrypting vault…' : 'Create vault'}
          </button>
        </form>
      </div>
    </div>
  )
}
