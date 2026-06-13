import { useParty } from 'canton-connect-kit'
import { useState } from 'react'
import { usePools } from '@/darkpool/hooks'
import { Balances } from './Balances'
import { ClearingChart } from './ClearingChart'
import { MarketBar } from './MarketBar'
import { MyFills } from './MyFills'
import { MyOpenOrders } from './MyOpenOrders'
import { OrderEntry } from './OrderEntry'
import { ShieldedBook } from './ShieldedBook'

export const TradeView = (): JSX.Element => {
  const { party } = useParty()
  if (!party) return <div className="py-10 text-center text-muted-foreground">Loading…</div>
  return <TradeWorkspace party={party.partyId} />
}

export const TradeWorkspace = ({ party: partyId }: { party: string }): JSX.Element => {
  const pools = usePools()
  const [poolId, setPoolId] = useState(pools[0]?.poolId ?? '')
  const pool = pools.find((p) => p.poolId === poolId) ?? pools[0]

  if (!pool) return <div className="py-10 text-center text-muted-foreground">Loading…</div>

  return (
    <div className="flex flex-col gap-3.5">
      <MarketBar pool={pool} pools={pools} onPoolChange={setPoolId} />

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[330px_1fr_300px]">
        <OrderEntry pool={pool} party={partyId} />

        <div className="flex flex-col gap-3.5">
          <ShieldedBook pool={pool} />
          <ClearingChart pool={pool} />
        </div>

        <div className="flex flex-col gap-3.5">
          <Balances pool={pool} party={partyId} />
          <MyOpenOrders pool={pool} party={partyId} />
        </div>
      </div>

      <MyFills pool={pool} party={partyId} />
    </div>
  )
}
