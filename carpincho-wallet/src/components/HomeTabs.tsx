import { useState } from 'react'
import { ActivityList } from '@/components/ActivityList'
import { AssetsPanel } from '@/components/AssetsPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  transactions: TransactionRecord[]
  assetsApi?: Cip56TransferApi
}

// The only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body; Assets remains mounted so pending-transfer polling can badge the tab.
export const HomeTabs = ({ transactions, assetsApi }: HomeTabsProps): JSX.Element => {
  const [pendingTransferCount, setPendingTransferCount] = useState(0)

  return (
    <Tabs
      defaultValue="activity"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList>
        <TabTrigger value="activity">Activity</TabTrigger>
        <TabTrigger value="assets">
          <span>Assets</span>
          {pendingTransferCount > 0 ? (
            <span className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[0.72rem] leading-5 text-primary-foreground">
              {pendingTransferCount}
            </span>
          ) : null}
        </TabTrigger>
      </TabsList>
      <TabContent
        value="activity"
        className={TAB_CONTENT_CLASS}
      >
        <ActivityList transactions={transactions} />
      </TabContent>
      <TabContent
        forceMount
        value="assets"
        className={TAB_CONTENT_CLASS}
      >
        <AssetsPanel
          api={assetsApi}
          onPendingCountChange={setPendingTransferCount}
        />
      </TabContent>
    </Tabs>
  )
}
