import { useCallback, useSyncExternalStore } from 'react'
import { useDarkPoolClient } from './DarkPoolProvider'
import type { Balance, DarkPoolClient, Fill, Order, Pool, Trade } from './types'

const useSnapshot = <T>(read: (client: DarkPoolClient) => T): T => {
  const client = useDarkPoolClient()
  const subscribe = useCallback((cb: () => void) => client.subscribe(cb), [client])
  const getSnapshot = useCallback(() => read(client), [client, read])
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export const usePools = (): Pool[] => useSnapshot((c) => c.listPools())

export const useBalances = (party: string): Balance[] =>
  useSnapshot(useCallback((c: DarkPoolClient) => c.getBalances(party), [party]))

export const useMyOrders = (party: string): Order[] =>
  useSnapshot(useCallback((c: DarkPoolClient) => c.listMyOrders(party), [party]))

export const useMyFills = (party: string): Fill[] =>
  useSnapshot(useCallback((c: DarkPoolClient) => c.listMyFills(party), [party]))

export const useBook = (poolId: string): Order[] =>
  useSnapshot(useCallback((c: DarkPoolClient) => c.listBook(poolId), [poolId]))

export const useTrades = (poolId: string): Trade[] =>
  useSnapshot(useCallback((c: DarkPoolClient) => c.listTrades(poolId), [poolId]))

export const useDarkPoolActions = (): DarkPoolClient => useDarkPoolClient()
