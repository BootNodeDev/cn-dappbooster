import { useCallback, useState } from 'react'
import type { DappClient } from '@canton-network/dapp-sdk'
import {
  COUNTER_PACKAGE_ID,
  COUNTER_TEMPLATE_ID,
  type CounterContract,
  addUserCommand,
  addViewerCommand,
  createCounterCommand,
  incrementCounterCommand,
  normalizeCounterContract
} from '../counterSignature.js'
import { commandId, short } from '../counterHelpers.js'
import { loadNetworkConfig, saveNetworkConfig } from '../../../config/networkConfig.js'
import { connectWallet, type WalletAccount } from '../../wallet/wallet.js'

export interface ConnectedState {
  client: DappClient
  account: WalletAccount
}

export interface CounterWorkspaceState {
  connected: ConnectedState | undefined
  counters: CounterContract[]
  pairingUri: string | undefined
  pairingCopied: boolean
  networkConfig: ReturnType<typeof loadNetworkConfig>
  partyDrafts: Record<string, string>
  busy: boolean
  error: string | undefined
  info: string | undefined
  clearError: () => void
  clearInfo: () => void
  onNetworkChange: (network: string) => void
  loadCounters: (state?: ConnectedState) => Promise<void>
  onConnect: () => Promise<void>
  onDisconnect: () => Promise<void>
  copyPairingUri: () => Promise<void>
  cancelPairing: () => void
  updateDraft: (contractId: string, value: string) => void
  createCounter: () => Promise<void>
  incrementCounter: (counter: CounterContract) => Promise<void>
  addUser: (counter: CounterContract, partyId: string) => Promise<void>
  addViewer: (counter: CounterContract, partyId: string) => Promise<void>
}

export const useCounterWorkspace = (): CounterWorkspaceState => {
  const [connected, setConnected] = useState<ConnectedState | undefined>(undefined)
  const [counters, setCounters] = useState<CounterContract[]>([])
  const [pairingUri, setPairingUri] = useState<string | undefined>(undefined)
  const [pairingCopied, setPairingCopied] = useState(false)
  const [networkConfig, setNetworkConfig] = useState(() => loadNetworkConfig())
  const [partyDrafts, setPartyDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [info, setInfo] = useState<string | undefined>(undefined)

  const onNetworkChange = (network: string): void => {
    const saved = saveNetworkConfig({ ...networkConfig, cantonNetwork: network })
    setNetworkConfig(saved)
    setError(undefined)
  }

  const loadCounters = useCallback(async (state = connected): Promise<void> => {
    if (state === undefined) {
      return
    }
    const response = await state.client.ledgerApi({
      requestMethod: 'post',
      resource: '/v2/state/active-contracts',
      body: {
        parties: [state.account.partyId],
        templateIds: [COUNTER_TEMPLATE_ID],
        filterByParty: true
      }
    }) as { contracts?: unknown[] }
    setCounters((response.contracts ?? []).flatMap(row => {
      const counter = normalizeCounterContract(row)
      return counter === undefined ? [] : [counter]
    }))
  }, [connected])

  const runCommand = useCallback(async (prefix: string, command: unknown): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)
    setError(undefined)
    try {
      await connected.client.prepareExecuteAndWait({
        commandId: commandId(prefix),
        commands: [command],
        actAs: [connected.account.partyId],
        readAs: [connected.account.partyId],
        packageIdSelectionPreference: [COUNTER_PACKAGE_ID]
      })
      await loadCounters(connected)
      setInfo('Transaction executed.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }
  }, [connected, loadCounters])

  const onConnect = async (): Promise<void> => {
    setBusy(true)
    setError(undefined)
    setInfo(undefined)
    setPairingUri(undefined)
    setPairingCopied(false)
    try {
      const next = await connectWallet({
        chainId: networkConfig.cantonNetwork,
        onUri: setPairingUri
      })
      setConnected(next)
      setPairingUri(undefined)
      await loadCounters(next)
      setInfo(`Connected as ${short(next.account.partyId)}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }
  }

  const onDisconnect = async (): Promise<void> => {
    if (connected === undefined) {
      return
    }
    setBusy(true)
    setError(undefined)
    setInfo(undefined)

    let disconnectError: string | undefined
    try {
      await connected.client.disconnect()
    } catch (err) {
      disconnectError = (err as Error).message
    } finally {
      setConnected(undefined)
      setCounters([])
      setPartyDrafts({})
      setPairingUri(undefined)
      setPairingCopied(false)
      setBusy(false)
    }

    if (disconnectError === undefined) {
      setInfo('Disconnected.')
    } else {
      setError(`Local logout complete; wallet disconnect failed: ${disconnectError}`)
    }
  }

  const copyPairingUri = async (): Promise<void> => {
    if (pairingUri === undefined) {
      return
    }
    await navigator.clipboard.writeText(pairingUri)
    setPairingCopied(true)
    window.setTimeout(() => setPairingCopied(false), 1400)
  }

  const cancelPairing = (): void => {
    setPairingCopied(false)
    setPairingUri(undefined)
  }

  const updateDraft = (contractId: string, value: string): void => {
    setPartyDrafts(prev => ({ ...prev, [contractId]: value }))
  }

  const createCounter = async (): Promise<void> => {
    if (connected === undefined) {
      return
    }
    await runCommand('create-counter', createCounterCommand(connected.account.partyId))
  }

  const incrementCounter = async (counter: CounterContract): Promise<void> => {
    if (connected === undefined) {
      return
    }
    await runCommand('increment-counter', incrementCounterCommand(counter, connected.account.partyId))
  }

  const addUser = async (counter: CounterContract, partyId: string): Promise<void> => {
    await runCommand('add-user', addUserCommand(counter, partyId))
  }

  const addViewer = async (counter: CounterContract, partyId: string): Promise<void> => {
    await runCommand('add-viewer', addViewerCommand(counter, partyId))
  }

  return {
    connected,
    counters,
    pairingUri,
    pairingCopied,
    networkConfig,
    partyDrafts,
    busy,
    error,
    info,
    clearError: () => setError(undefined),
    clearInfo: () => setInfo(undefined),
    onNetworkChange,
    loadCounters,
    onConnect,
    onDisconnect,
    copyPairingUri,
    cancelPairing,
    updateDraft,
    createCounter,
    incrementCounter,
    addUser,
    addViewer
  }
}
