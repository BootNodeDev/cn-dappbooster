import { useCallback, useMemo, useState } from 'react'
import { ActivityList } from '@/components/ActivityList'
import { type Cip56SendApi, SendTokensPanel } from '@/components/SendTokensPanel'
import { TokensPanel } from '@/components/TokensPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic, TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  account?: AccountPublic
  transactions: TransactionRecord[]
  tokensApi?: Cip56HoldingsApi
  transfersApi?: Cip56TransferApi
  sendApi?: Cip56SendApi
}

// The only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body; token-related balances and actions share the Tokens view.
export const HomeTabs = ({
  account,
  transactions,
  tokensApi,
  transfersApi,
  sendApi,
}: HomeTabsProps): React.JSX.Element => {
  const activeAccountId = account?.id
  const [pendingTransferState, setPendingTransferState] = useState<{
    accountId: string | undefined
    count: number
  }>({ accountId: undefined, count: 0 })
  const pendingTransferCount =
    pendingTransferState.accountId === activeAccountId ? pendingTransferState.count : 0
  const onPendingTransferCountChange = useCallback(
    (count: number) => {
      setPendingTransferState({ accountId: activeAccountId, count })
    },
    [activeAccountId],
  )
  const activeTransactions = useMemo(
    () =>
      account === undefined
        ? transactions
        : transactions.filter(
            (tx) => tx.accountId === account.id || tx.partyId === account.partyId,
          ),
    [account, transactions],
  )

  return (
    <Tabs
      defaultValue="activity"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList>
        <TabTrigger value="activity">Activity</TabTrigger>
        <TabTrigger value="tokens">
          <span>Tokens</span>
          {pendingTransferCount > 0 ? (
            <span className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[0.72rem] leading-5 text-primary-foreground">
              {pendingTransferCount}
            </span>
          ) : null}
        </TabTrigger>
        <TabTrigger value="send">Send</TabTrigger>
      </TabsList>
      <TabContent
        value="activity"
        className={TAB_CONTENT_CLASS}
      >
        <ActivityList transactions={activeTransactions} />
      </TabContent>
      <TabContent
        forceMount
        value="tokens"
        className={TAB_CONTENT_CLASS}
      >
        <TokensPanel
          account={account}
          api={tokensApi}
          transfersApi={transfersApi}
          onPendingTransferCountChange={onPendingTransferCountChange}
        />
      </TabContent>
      <TabContent
        value="send"
        className={TAB_CONTENT_CLASS}
      >
        <SendTokensPanel
          account={account}
          holdingsApi={tokensApi}
          sendApi={sendApi}
        />
      </TabContent>
    </Tabs>
  )
}
