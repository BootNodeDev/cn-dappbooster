import { useCallback, useMemo, useState } from 'react'
import { isTransferHistoryTransaction } from '@/cip56/transfers'
import { ActivityList } from '@/components/ActivityList'
import { AssetsPanel } from '@/components/AssetsPanel'
import type { Cip56SendApi } from '@/components/SendTokenForm'
import { TransfersPanel } from '@/components/TransfersPanel'
import { TabContent, Tabs, TabsList, TabTrigger } from '@/components/ui/Tabs'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import type { Cip56TransferApi } from '@/hooks/usePendingCip56Transfers'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic, TransactionRecord } from '@/vault/types'

interface HomeTabsProps {
  account?: AccountPublic
  transactions: TransactionRecord[]
  tokensApi?: Cip56HoldingsApi
  transfersApi?: Cip56TransferApi
  preapprovalApi?: AmuletPreapprovalApi
  sendApi?: Cip56SendApi
}

// The only scrolling region between the account selector and the footer.
const TAB_CONTENT_CLASS = 'min-h-0 flex-1 overflow-y-auto outline-none'

// Tabbed home body; assets, transfers, activity, and sending each own a tab.
export const HomeTabs = ({
  account,
  transactions,
  tokensApi,
  transfersApi,
  preapprovalApi,
  sendApi,
}: HomeTabsProps): JSX.Element => {
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
  // Transfer history moves into the Transfers tab; everything else stays under Activity.
  const { transferTransactions, otherTransactions } = useMemo(() => {
    const transfersHistory: TransactionRecord[] = []
    const other: TransactionRecord[] = []
    for (const tx of activeTransactions) {
      if (isTransferHistoryTransaction(tx.method)) {
        transfersHistory.push(tx)
      } else {
        other.push(tx)
      }
    }
    return { transferTransactions: transfersHistory, otherTransactions: other }
  }, [activeTransactions])

  return (
    <Tabs
      defaultValue="assets"
      className="flex min-h-0 flex-1 flex-col"
    >
      <TabsList>
        <TabTrigger value="assets">Assets</TabTrigger>
        <TabTrigger value="transfers">
          <span>Transfers</span>
          {pendingTransferCount > 0 ? (
            <span className="ml-1 inline-grid min-w-5 place-items-center rounded-full bg-danger px-1.5 text-[0.72rem] leading-5 text-primary-foreground">
              {pendingTransferCount}
            </span>
          ) : null}
        </TabTrigger>
        <TabTrigger value="activity">Activity</TabTrigger>
      </TabsList>
      <TabContent
        value="assets"
        className={TAB_CONTENT_CLASS}
      >
        <AssetsPanel
          account={account}
          api={tokensApi}
          sendApi={sendApi}
        />
      </TabContent>
      <TabContent
        forceMount
        value="transfers"
        className={TAB_CONTENT_CLASS}
      >
        <TransfersPanel
          account={account}
          api={transfersApi}
          preapprovalApi={preapprovalApi}
          onPendingCountChange={onPendingTransferCountChange}
          historyTransactions={transferTransactions}
        />
      </TabContent>
      <TabContent
        value="activity"
        className={TAB_CONTENT_CLASS}
      >
        <ActivityList transactions={otherTransactions} />
      </TabContent>
    </Tabs>
  )
}
