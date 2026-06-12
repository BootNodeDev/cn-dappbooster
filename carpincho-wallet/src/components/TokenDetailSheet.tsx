import { useEffect, useRef, useState } from 'react'
import cantonIcon from '@/assets/canton.png'
import { formatTokenAmount } from '@/cip56/amount'
import type { TokenHolding, TokenHoldingSummary } from '@/cip56/holdings'
import { type Cip56SendApi, SendTokenForm } from '@/components/SendTokenForm'
import { TokenHoldingDetail } from '@/components/TokenHoldingDetail'
import { TokenReceive } from '@/components/TokenReceive'
import { SecondaryButton } from '@/components/ui/Button'
import { CHEVRON_RIGHT_ICON, RECEIVE_ICON, SEND_ICON } from '@/components/ui/icons'
import { Sheet } from '@/components/ui/Sheet'
import { useTokenHoldingDetails } from '@/hooks/useTokenHoldingDetails'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'

type Screen = 'detail' | 'send' | 'receive' | 'holding'

export interface TokenDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountPublic
  summary: TokenHoldingSummary
  holdingsApi?: Cip56HoldingsApi
  sendApi?: Cip56SendApi
  // Lets the host refresh holdings after a transfer leaves the wallet.
  onSent?: () => void
}

interface DetailScreenProps {
  summary: TokenHoldingSummary
  holdings: TokenHolding[]
  loading: boolean
  error?: string
  onSend: () => void
  onReceive: () => void
  onOpenHolding: (holding: TokenHolding) => void
}

// One holding in the balance-screen list: amount left, chevron right.
const HoldingListRow = ({
  holding,
  onOpen,
}: {
  holding: TokenHolding
  onOpen: () => void
}): JSX.Element => {
  const view = holding.interfaceViewValue
  return (
    <button
      type="button"
      onClick={onOpen}
      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 text-left outline-none transition-colors hover:bg-primary-soft/40 focus-visible:bg-primary-soft/60"
    >
      <span className="min-w-0">
        <span className="block text-[0.7rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Amount
        </span>
        <span className="flex items-center gap-2">
          <span className="min-w-0 truncate text-[0.9rem] font-medium text-foreground">
            {formatTokenAmount(view?.amount ?? 'unknown')}
          </span>
          {view?.lock == null ? null : (
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase text-muted-foreground">
              Locked
            </span>
          )}
        </span>
      </span>
      <span
        aria-hidden="true"
        className="justify-self-end text-muted-foreground"
      >
        {CHEVRON_RIGHT_ICON}
      </span>
    </button>
  )
}

// Balance-first root screen: total, send/receive, then the holdings list.
const DetailScreen = ({
  summary,
  holdings,
  loading,
  error,
  onSend,
  onReceive,
  onOpenHolding,
}: DetailScreenProps): JSX.Element => (
  <div className="flex flex-col gap-5">
    <div className="flex flex-col items-center gap-1.5 text-center">
      <span className="break-all font-display text-3xl font-bold tracking-tight text-foreground">
        {formatTokenAmount(summary.totalAmount)}
      </span>
      <span className="flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted-foreground">
        <img
          src={cantonIcon}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="size-4 rounded-full"
        />
        {summary.tokenLabel}
      </span>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <SecondaryButton onClick={onSend}>
        {SEND_ICON}
        Send
      </SecondaryButton>
      <SecondaryButton onClick={onReceive}>
        {RECEIVE_ICON}
        Receive
      </SecondaryButton>
    </div>

    <div className="flex flex-col gap-2">
      <div className="px-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Holdings
      </div>
      {loading && holdings.length === 0 ? (
        <p className="m-0 px-1 text-[0.82rem] text-muted-foreground">Loading UTXOs</p>
      ) : error !== undefined ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      ) : holdings.length === 0 ? (
        <p className="m-0 px-1 text-[0.82rem] text-muted-foreground">No UTXO details</p>
      ) : (
        holdings.map((holding) => (
          <HoldingListRow
            key={holding.contractId}
            holding={holding}
            onOpen={() => onOpenHolding(holding)}
          />
        ))
      )}
    </div>
  </div>
)

// Single token modal: a screen stack (detail / send / receive / holding) inside one sheet.
export const TokenDetailSheet = ({
  open,
  onOpenChange,
  account,
  summary,
  holdingsApi,
  sendApi,
  onSent,
}: TokenDetailSheetProps): JSX.Element => {
  const [screen, setScreen] = useState<Screen>('detail')
  const [activeHolding, setActiveHolding] = useState<TokenHolding | null>(null)
  const [direction, setDirection] = useState<'forward' | 'back'>('forward')
  const screenRef = useRef<HTMLDivElement>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run on every screen change to refocus the new view.
  useEffect(() => {
    if (!open) return
    const root = screenRef.current
    if (root === null) return
    const target = root.querySelector<HTMLElement>(
      'button, [href], input, [tabindex]:not([tabindex="-1"])',
    )
    target?.focus()
  }, [open, screen])

  const detailsApi =
    holdingsApi?.listTokenHoldings === undefined
      ? undefined
      : { listTokenHoldings: holdingsApi.listTokenHoldings }
  const { holdings, loading, error } = useTokenHoldingDetails(account, summary, {
    api: detailsApi,
    enabled: open,
  })

  const handleOpenChange = (next: boolean): void => {
    if (!next) {
      setScreen('detail')
      setActiveHolding(null)
      setDirection('forward')
    }
    onOpenChange(next)
  }

  const goTo = (next: Screen): void => {
    setDirection('forward')
    setScreen(next)
  }

  // The screen hierarchy is flat: every non-detail screen returns to detail.
  const goBack = (): void => {
    if (screen === 'detail') {
      handleOpenChange(false)
      return
    }
    setDirection('back')
    setScreen('detail')
  }

  const openHolding = (holding: TokenHolding): void => {
    setActiveHolding(holding)
    goTo('holding')
  }

  // After a transfer leaves the wallet, refresh the host and return to the balance view.
  const handleSent = (): void => {
    onSent?.()
    setDirection('back')
    setScreen('detail')
  }

  const title =
    screen === 'send'
      ? `Send ${summary.tokenLabel}`
      : screen === 'receive'
        ? 'Receive'
        : screen === 'holding'
          ? 'Holding details'
          : summary.tokenLabel
  const animationClass =
    direction === 'forward' ? 'animate-slide-in-right' : 'animate-slide-in-left'

  return (
    <Sheet
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={`${summary.tokenLabel} token details`}
      hideTitle={screen === 'detail'}
      onBack={screen === 'detail' ? undefined : goBack}
      side="center"
    >
      <div
        key={screen}
        ref={screenRef}
        className={animationClass}
      >
        {screen === 'detail' && (
          <DetailScreen
            summary={summary}
            holdings={holdings}
            loading={loading}
            error={error}
            onSend={() => goTo('send')}
            onReceive={() => goTo('receive')}
            onOpenHolding={openHolding}
          />
        )}
        {screen === 'send' && (
          <SendTokenForm
            account={account}
            summary={summary}
            sendApi={sendApi}
            onSent={handleSent}
          />
        )}
        {screen === 'receive' && <TokenReceive partyId={account.partyId} />}
        {screen === 'holding' && activeHolding !== null && (
          <TokenHoldingDetail holding={activeHolding} />
        )}
      </div>
    </Sheet>
  )
}
