import { useEffect, useState } from 'react'
import { walletServiceRequest } from '../api/walletService.js'
import { useRuntimeConfig } from '../config/useRuntimeConfig.js'
import type { RuntimeConfig } from '../config/runtimeConfig.js'

interface WalletServiceStatus {
  connection?: {
    isNetworkConnected?: boolean
    networkReason?: string
  }
  network?: {
    networkId?: string
  }
}

export const ConnectionSettingsView = (): JSX.Element => {
  const { config, saveConfig } = useRuntimeConfig()
  const [draft, setDraft] = useState<RuntimeConfig>(config)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | undefined>(undefined)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => setDraft(config), [config])

  const onSave = (): void => {
    const saved = saveConfig(draft)
    setDraft(saved)
    setError(undefined)
    setMessage('Saved.')
  }

  const onTest = async (): Promise<void> => {
    setBusy(true)
    setMessage(undefined)
    setError(undefined)
    try {
      const status = await walletServiceRequest<WalletServiceStatus>('status', undefined, {
        rpcUrl: draft.walletServiceRpcUrl
      })
      const network = status.network?.networkId ?? 'unknown network'
      const connected = status.connection?.isNetworkConnected === true
      const reason = status.connection?.networkReason
      setMessage(connected
        ? `wallet-service reachable: ${network}`
        : `wallet-service responded, Canton not connected: ${reason ?? network}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card-soft mb-3">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="mb-0">Connection settings</h5>
        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDraft(config)}>
          Reset
        </button>
      </div>

      <div className="mb-2">
        <label htmlFor="wallet-service-rpc">Wallet-service RPC URL</label>
        <input
          id="wallet-service-rpc"
          type="url"
          className="form-control mono"
          value={draft.walletServiceRpcUrl}
          onChange={e => setDraft(prev => ({ ...prev, walletServiceRpcUrl: e.target.value }))}
          placeholder="http://localhost:3010/rpc"
        />
      </div>

      <div className="mb-2">
        <label htmlFor="canton-network">WalletConnect Canton network</label>
        <input
          id="canton-network"
          type="text"
          className="form-control mono"
          value={draft.cantonNetwork}
          onChange={e => setDraft(prev => ({ ...prev, cantonNetwork: e.target.value }))}
          placeholder="canton:local"
        />
      </div>

      {message !== undefined && <div className="info-box mb-2">{message}</div>}
      {error !== undefined && <div className="error-box mb-2">{error}</div>}

      <div className="d-flex gap-2">
        <button type="button" className="btn btn-arg" onClick={onSave}>
          Save
        </button>
        <button type="button" className="btn btn-outline-secondary" onClick={() => { void onTest() }} disabled={busy}>
          {busy ? 'Testing...' : 'Test wallet-service'}
        </button>
      </div>
    </section>
  )
}
