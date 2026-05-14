import type { NetworkConfig } from '../../../config/networkConfig.js'
import { short } from '../counterHelpers.js'
import type { ConnectedState } from '../hooks/useCounterWorkspace.js'
import { PairingPopover } from './PairingPopover.js'

interface AppHeaderProps {
  networkConfig: NetworkConfig
  connected: ConnectedState | undefined
  busy: boolean
  pairingUri: string | undefined
  pairingCopied: boolean
  onNetworkChange: (network: string) => void
  onConnect: () => Promise<void>
  onDisconnect: () => Promise<void>
  onRefreshCounters: () => Promise<void>
  onCopyPairingUri: () => Promise<void>
  onCancelPairing: () => void
}

export const AppHeader = ({
  networkConfig,
  connected,
  busy,
  pairingUri,
  pairingCopied,
  onNetworkChange,
  onConnect,
  onDisconnect,
  onRefreshCounters,
  onCopyPairingUri,
  onCancelPairing
}: AppHeaderProps): JSX.Element => (
  <header className="app-header">
    <div>
      <p className="eyebrow">Canton base</p>
      <h1>Counter</h1>
    </div>
    <div className="header-actions">
      <select
        className="network-select"
        value={networkConfig.cantonNetwork}
        onChange={event => onNetworkChange(event.target.value)}
        aria-label="Network"
      >
        <option value="canton:local">canton:local</option>
      </select>
      <div className="connect-area">
        {connected === undefined ? (
          <button className="primary" type="button" onClick={() => { void onConnect() }} disabled={busy}>
            {busy ? 'Connecting...' : 'Connect'}
          </button>
        ) : (
          <div className="connected-controls">
            <button className="account-chip" type="button" onClick={() => { void onRefreshCounters() }} disabled={busy}>
              {short(connected.account.partyId)}
            </button>
            <button className="logout-button" type="button" onClick={() => { void onDisconnect() }} disabled={busy}>
              Logout
            </button>
          </div>
        )}
        {connected === undefined && (busy || pairingUri !== undefined) && (
          <PairingPopover
            pairingUri={pairingUri}
            pairingCopied={pairingCopied}
            onCopyPairingUri={onCopyPairingUri}
            onCancelPairing={onCancelPairing}
          />
        )}
      </div>
    </div>
  </header>
)
