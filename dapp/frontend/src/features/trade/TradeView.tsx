import { useParty } from 'canton-connect-kit'
import { motion } from 'framer-motion'
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

  const ease = [0.16, 1, 0.3, 1] as const
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay, ease },
  })

  return (
    <div className="flex flex-col gap-5">
      <MarketBar pool={pool} pools={pools} onPoolChange={setPoolId} />

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[340px_1fr]">
        <motion.div className="flex flex-col gap-4" {...rise(0)}>
          <OrderEntry pool={pool} party={partyId} />
          <Balances pool={pool} party={partyId} />
        </motion.div>

        <motion.div className="flex flex-col gap-4" {...rise(0.1)}>
          <ShieldedBook pool={pool} />
          <ClearingChart pool={pool} />
        </motion.div>
      </div>

      <motion.div {...rise(0.2)}>
        <MyOpenOrders pool={pool} party={partyId} />
      </motion.div>

      <motion.div {...rise(0.3)}>
        <MyFills pool={pool} party={partyId} />
      </motion.div>
    </div>
  )
}
