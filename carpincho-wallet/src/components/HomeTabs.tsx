import { ActivityList } from '@/components/ActivityList'
import { AssetsPanel } from '@/components/AssetsPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  transactions: TransactionRecord[]
}

// The tab content is the only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body. Activity is first; Assets is a mocked placeholder for a future tab.
export const HomeTabs = ({ transactions }: HomeTabsProps): JSX.Element => (
  <Tabs
    defaultValue="activity"
    className="flex min-h-0 flex-1 flex-col"
  >
    <TabsList>
      <TabTrigger value="activity">Activity</TabTrigger>
      <TabTrigger value="assets">Assets</TabTrigger>
    </TabsList>
    <TabContent
      value="activity"
      className={TAB_CONTENT_CLASS}
    >
      <ActivityList transactions={transactions} />
    </TabContent>
    <TabContent
      value="assets"
      className={TAB_CONTENT_CLASS}
    >
      <AssetsPanel />
    </TabContent>
  </Tabs>
)
