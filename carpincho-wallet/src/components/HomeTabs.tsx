import { ActivityList } from '@/components/ActivityList'
import { TokensPanel } from '@/components/TokensPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  transactions: TransactionRecord[]
  tokensApi?: Cip56HoldingsApi
}

// The only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body; token-related balances and actions share the Tokens view.
export const HomeTabs = ({ transactions, tokensApi }: HomeTabsProps): JSX.Element => (
  <Tabs
    defaultValue="activity"
    className="flex min-h-0 flex-1 flex-col"
  >
    <TabsList>
      <TabTrigger value="activity">Activity</TabTrigger>
      <TabTrigger value="tokens">Tokens</TabTrigger>
    </TabsList>
    <TabContent
      value="activity"
      className={TAB_CONTENT_CLASS}
    >
      <ActivityList transactions={transactions} />
    </TabContent>
    <TabContent
      value="tokens"
      className={TAB_CONTENT_CLASS}
    >
      <TokensPanel api={tokensApi} />
    </TabContent>
  </Tabs>
)
