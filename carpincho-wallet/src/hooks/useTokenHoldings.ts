import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  listTokenHoldings,
  summarizeTokenHoldings,
  type TokenHolding,
  type TokenHoldingSummary,
} from '@/cip56/holdings'
import type { AccountPublic } from '@/vault/types'

export interface Cip56HoldingsApi {
  listTokenHoldings: (partyId: string) => Promise<TokenHolding[]>
}

export interface TokenHoldingsState {
  holdings: TokenHolding[]
  summaries: TokenHoldingSummary[]
  loading: boolean
  error?: string
  refresh: () => Promise<void>
}

interface TokenHoldingsData {
  accountKey?: string
  holdings: TokenHolding[]
}

interface TokenHoldingsError {
  accountKey?: string
  message: string
}

export interface TokenHoldingsOptions {
  pollMs?: number | null
  api?: Cip56HoldingsApi
}

const defaultApi: Cip56HoldingsApi = {
  listTokenHoldings,
}

export const TOKEN_HOLDINGS_POLL_MS = 5_000

// Polls token holdings while the Tokens tab is mounted because LocalNet exposes no browser stream.
export const useTokenHoldings = (
  account: AccountPublic | undefined,
  options: TokenHoldingsOptions = {},
): TokenHoldingsState => {
  const api = options.api ?? defaultApi
  const pollMs = options.pollMs === undefined ? TOKEN_HOLDINGS_POLL_MS : options.pollMs
  const [data, setData] = useState<TokenHoldingsData>({ holdings: [] })
  const [loading, setLoading] = useState(false)
  const [errorData, setErrorData] = useState<TokenHoldingsError | undefined>(undefined)
  const accountKey = account === undefined ? undefined : `${account.id}:${account.partyId}`
  const currentAccountKey = useRef(accountKey)
  currentAccountKey.current = accountKey
  const holdings = data.accountKey === accountKey ? data.holdings : []
  const error =
    errorData !== undefined && errorData.accountKey === accountKey ? errorData.message : undefined

  // Refreshes holdings for the active party and keeps the previous list on transient errors.
  const refresh = useCallback(async (): Promise<void> => {
    if (account === undefined) {
      setData({ holdings: [] })
      setErrorData(undefined)
      return
    }
    setLoading(true)
    try {
      const nextHoldings = await api.listTokenHoldings(account.partyId)
      if (accountKey === currentAccountKey.current) {
        setData({ accountKey, holdings: nextHoldings })
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
    // Polls serially so slow wallet-service calls cannot overlap.
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

  const summaries = useMemo(() => summarizeTokenHoldings(holdings), [holdings])

  return useMemo(
    () => ({ holdings, summaries, loading, ...(error === undefined ? {} : { error }), refresh }),
    [holdings, summaries, loading, error, refresh],
  )
}
