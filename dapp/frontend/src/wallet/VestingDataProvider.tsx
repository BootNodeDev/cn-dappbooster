// Bridges canton-connect-kit's wallet-signed submission to the AmuletBackend.
//
// The backend has two transports (see AmuletBackend): this provider supplies
// the SubmitFn (connect-kit useExecute → Carpincho) for command submission,
// while the backend keeps the wallet-service /rpc channel (from the loaded
// deployment config) for SCAN context + cross-party ACS reads. The connected
// party is NOT captured here — the backend passes the acting party per command
// (proposer/receiver/creator), and that party is always the connected one.

import { useExecute } from 'canton-connect-kit'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { type BackendConfig, createBackend, loadBackendConfig } from '@/backend/createBackend'
import type { VestingBackend } from '@/backend/VestingBackend'
import { toExecuteParams } from './submit'
import type { SubmitFn } from './Wallet'

const EMPTY_CONFIG: BackendConfig = { rpcUrl: '', deployment: { pkg: '', operator: '' } }

export interface VestingDataContextValue {
  backend: VestingBackend
  backendAvailable: boolean
}

const VestingDataContext = createContext<VestingDataContextValue | undefined>(undefined)

export const VestingDataProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
  const { execute } = useExecute()
  const [config, setConfig] = useState<BackendConfig>(EMPTY_CONFIG)
  const [backendAvailable, setBackendAvailable] = useState(false)

  // Keep the latest execute in a ref so the SubmitFn — and therefore the
  // backend — stays referentially stable across connect/disconnect (which swap
  // the execute identity) instead of rebuilding the backend on every change.
  const executeRef = useRef(execute)
  executeRef.current = execute

  const submit = useCallback<SubmitFn>(
    (actingParty, command, disclosed) =>
      executeRef.current(toExecuteParams(actingParty, command, disclosed)),
    [],
  )

  const backend = useMemo(() => createBackend(config, submit), [config, submit])

  useEffect(() => {
    let cancelled = false
    void loadBackendConfig().then((loaded) => {
      if (!cancelled) {
        setConfig(loaded)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void backend
      .isAvailable()
      .then((ok) => {
        if (!cancelled) {
          setBackendAvailable(ok)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBackendAvailable(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [backend])

  const value = useMemo<VestingDataContextValue>(
    () => ({ backend, backendAvailable }),
    [backend, backendAvailable],
  )

  return <VestingDataContext.Provider value={value}>{children}</VestingDataContext.Provider>
}

export const useVestingData = (): VestingDataContextValue => {
  const ctx = useContext(VestingDataContext)
  if (ctx === undefined) {
    throw new Error('useVestingData must be used within a VestingDataProvider')
  }
  return ctx
}
