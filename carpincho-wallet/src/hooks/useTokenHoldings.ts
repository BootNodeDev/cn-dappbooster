import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
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
  const query = useQuery({
    enabled: account !== undefined,
    queryKey: ['cip56', 'holdings', account?.id, account?.partyId],
    queryFn: () => api.listTokenHoldings(account?.partyId ?? ''),
    refetchInterval: pollMs === null ? false : pollMs,
  })
  const holdings = query.data ?? []
  const error = query.error instanceof Error ? query.error.message : undefined

  // Imperative refresh lets send flows reload balances after creating a transfer.
  const refresh = useCallback(async (): Promise<void> => {
    if (account === undefined) {
      return
    }
    await query.refetch()
  }, [account, query])

  const summaries = useMemo(() => summarizeTokenHoldings(holdings), [holdings])

  return useMemo(
    () => ({
      holdings,
      summaries,
      loading: query.isFetching,
      ...(error === undefined ? {} : { error }),
      refresh,
    }),
    [holdings, summaries, query.isFetching, error, refresh],
  )
}
