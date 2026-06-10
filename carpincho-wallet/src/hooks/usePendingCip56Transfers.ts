import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  acceptPendingTransfer,
  listPendingIncomingTransfers,
  type PendingTokenTransfer,
} from '@/cip56/transfers'
import type { AccountPublic } from '@/vault/types'
import type { VaultContextValue } from '@/vault/VaultContext'

export interface Cip56TransferApi {
  listPendingIncomingTransfers: (partyId: string) => Promise<PendingTokenTransfer[]>
  acceptTransfer: (params: {
    account: AccountPublic
    transferInstructionCid: string
    signMessage: VaultContextValue['signMessage']
    recordTransaction: VaultContextValue['recordTransaction']
  }) => Promise<{ updateId?: string; completionOffset?: number }>
}

export interface PendingCip56TransfersState {
  transfers: PendingTokenTransfer[]
  loading: boolean
  error?: string
  refresh: () => Promise<void>
  accept: (transferInstructionCid: string) => Promise<void>
}

export interface PendingCip56TransfersOptions {
  pollMs?: number | null
  api?: Cip56TransferApi
  signMessage?: VaultContextValue['signMessage']
  recordTransaction?: VaultContextValue['recordTransaction']
}

interface PendingCip56TransfersData {
  accountKey?: string
  transfers: PendingTokenTransfer[]
}

interface PendingCip56TransfersError {
  accountKey?: string
  message: string
}

const defaultApi: Cip56TransferApi = {
  listPendingIncomingTransfers,
  acceptTransfer: acceptPendingTransfer,
}

export const CIP56_TRANSFER_POLL_MS = 5_000

// Polls pending incoming transfers because LocalNet exposes no browser stream for this flow.
export const usePendingCip56Transfers = (
  account: AccountPublic | undefined,
  options: PendingCip56TransfersOptions = {},
): PendingCip56TransfersState => {
  const api = options.api ?? defaultApi
  const pollMs = options.pollMs === undefined ? CIP56_TRANSFER_POLL_MS : options.pollMs
  const [data, setData] = useState<PendingCip56TransfersData>({ transfers: [] })
  const [loading, setLoading] = useState(false)
  const [errorData, setErrorData] = useState<PendingCip56TransfersError | undefined>(undefined)
  const accountKey = account === undefined ? undefined : `${account.id}:${account.partyId}`
  const currentAccountKey = useRef(accountKey)
  currentAccountKey.current = accountKey
  const transfers = data.accountKey === accountKey ? data.transfers : []
  const error =
    errorData !== undefined && errorData.accountKey === accountKey ? errorData.message : undefined

  const refresh = useCallback(async (): Promise<void> => {
    if (account === undefined) {
      setData({ transfers: [] })
      setErrorData(undefined)
      return
    }
    setLoading(true)
    try {
      const nextTransfers = await api.listPendingIncomingTransfers(account.partyId)
      if (accountKey === currentAccountKey.current) {
        setData({ accountKey, transfers: nextTransfers })
        setErrorData(undefined)
      }
    } catch (err) {
      if (accountKey === currentAccountKey.current) {
        setErrorData({ accountKey, message: (err as Error).message })
      }
    } finally {
      if (accountKey === currentAccountKey.current) {
        setLoading(false)
      }
    }
  }, [account, accountKey, api])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = async (): Promise<void> => {
      await refresh()
      if (!cancelled && pollMs !== null) {
        timer = setTimeout(() => {
          void tick()
        }, pollMs)
      }
    }
    void tick()
    return () => {
      cancelled = true
      if (timer !== undefined) {
        clearTimeout(timer)
      }
    }
  }, [refresh, pollMs])

  const accept = useCallback(
    async (transferInstructionCid: string): Promise<void> => {
      if (account === undefined) {
        throw new Error('no account selected')
      }
      if (options.signMessage === undefined || options.recordTransaction === undefined) {
        throw new Error('missing signing dependencies')
      }
      await api.acceptTransfer({
        account,
        transferInstructionCid,
        signMessage: options.signMessage,
        recordTransaction: options.recordTransaction,
      })
      await refresh()
    },
    [account, api, options.signMessage, options.recordTransaction, refresh],
  )

  return useMemo(
    () => ({ transfers, loading, ...(error === undefined ? {} : { error }), refresh, accept }),
    [transfers, loading, error, refresh, accept],
  )
}
