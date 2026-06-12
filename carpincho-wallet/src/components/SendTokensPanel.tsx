import { type FormEvent, useEffect, useMemo, useState } from 'react'
import type { ExecutePreparedResponse } from '@/api/interactiveSubmission'
import { type CreateTokenTransferParams, createTokenTransfer } from '@/cip56/transfers'
import { PrimaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import type { Cip56HoldingsApi } from '@/hooks/useTokenHoldings'
import { useTokenHoldings } from '@/hooks/useTokenHoldings'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export type TransferDeadline = '1h' | '1d' | '1w' | '1m' | '1y'

export interface Cip56SendApi {
  createTokenTransfer: (params: CreateTokenTransferParams) => Promise<ExecutePreparedResponse>
}

export interface SendTokensPanelProps {
  account?: AccountPublic
  holdingsApi?: Cip56HoldingsApi
  sendApi?: Cip56SendApi
}

const defaultSendApi: Cip56SendApi = {
  createTokenTransfer,
}

const DEADLINE_OPTIONS: Array<{ value: TransferDeadline; label: string }> = [
  { value: '1h', label: '1 hour' },
  { value: '1d', label: '1 day' },
  { value: '1w', label: '1 week' },
  { value: '1m', label: '1 month' },
  { value: '1y', label: '1 year' },
]

// Converts compact UI presets into absolute expiration timestamps for CIP-56 transfers.
export const transferDeadlineExpiration = (deadline: TransferDeadline, now = new Date()): Date => {
  const next = new Date(now.getTime())
  if (deadline === '1h') {
    next.setUTCHours(next.getUTCHours() + 1)
    return next
  }
  if (deadline === '1d') {
    next.setUTCDate(next.getUTCDate() + 1)
    return next
  }
  if (deadline === '1w') {
    next.setUTCDate(next.getUTCDate() + 7)
    return next
  }
  if (deadline === '1m') {
    next.setUTCMonth(next.getUTCMonth() + 1)
    return next
  }
  next.setUTCFullYear(next.getUTCFullYear() + 1)
  return next
}

// Renders the outgoing CIP-56 transfer form for the active Carpincho party.
export const SendTokensPanel = ({
  account,
  holdingsApi,
  sendApi = defaultSendApi,
}: SendTokensPanelProps): JSX.Element => {
  const vault = useVault()
  const activeAccount = account ?? vault.primary ?? vault.accounts[0]
  const { summaries, loading, error, refresh } = useTokenHoldings(activeAccount, {
    api: holdingsApi,
  })
  const [selectedTokenKey, setSelectedTokenKey] = useState('')
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [deadline, setDeadline] = useState<TransferDeadline>('1h')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)
  const [submitStatus, setSubmitStatus] = useState<string | undefined>(undefined)

  const selectedSummary = useMemo(
    () => summaries.find((summary) => summary.key === selectedTokenKey) ?? summaries[0],
    [selectedTokenKey, summaries],
  )

  // Keeps the selected token aligned with the latest holdings after polling or sending.
  useEffect(() => {
    if (selectedSummary !== undefined && selectedTokenKey !== selectedSummary.key) {
      setSelectedTokenKey(selectedSummary.key)
    }
    if (summaries.length === 0 && selectedTokenKey !== '') {
      setSelectedTokenKey('')
    }
  }, [selectedSummary, selectedTokenKey, summaries.length])

  // Submits the transfer intent while Carpincho remains the signer of the prepared transaction.
  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (activeAccount === undefined) {
      setSubmitError('No account selected')
      return
    }
    if (selectedSummary?.instrumentId?.id === undefined) {
      setSubmitError('Select a token')
      return
    }
    setSubmitting(true)
    setSubmitError(undefined)
    setSubmitStatus(undefined)
    try {
      await sendApi.createTokenTransfer({
        account: activeAccount,
        recipient: recipient.trim(),
        amount: amount.trim(),
        instrumentId: selectedSummary.instrumentId,
        ...(memo.trim() === '' ? {} : { memo: memo.trim() }),
        expirationDate: transferDeadlineExpiration(deadline).toISOString(),
        signMessage: vault.signMessage,
        recordTransaction: vault.recordTransaction,
      })
      setRecipient('')
      setAmount('')
      setMemo('')
      setSubmitStatus('Transfer submitted.')
      toast.success('Transfer submitted.')
      await refresh()
    } catch (err) {
      const message = (err as Error).message
      setSubmitError(message)
      toast.error(`Send failed: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (activeAccount === undefined) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 py-10 text-center">
        <p className="m-0 text-[0.95rem] font-medium text-muted-foreground">No account selected</p>
      </div>
    )
  }

  return (
    <form
      className="flex min-h-full flex-col gap-3 px-1 py-2"
      onSubmit={(event) => {
        void onSubmit(event)
      }}
    >
      <div className="flex items-center justify-between gap-3 px-1">
        <h2 className="m-0 text-[0.95rem] font-semibold text-foreground">Send tokens</h2>
        {loading ? <span className="text-[0.78rem] text-muted-foreground">Refreshing</span> : null}
      </div>

      {error === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {error}
        </div>
      )}

      {submitError === undefined ? null : (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[0.82rem] text-danger">
          {submitError}
        </div>
      )}

      {submitStatus === undefined ? null : (
        <div className="rounded-md border border-primary/30 bg-primary-soft px-3 py-2 text-[0.82rem] text-primary">
          {submitStatus}
        </div>
      )}

      <label
        className="grid gap-1 text-[0.78rem] font-semibold text-muted-foreground"
        htmlFor="send-token"
      >
        Token
        <select
          aria-label="Token"
          className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-0 focus:shadow-focus"
          disabled={summaries.length === 0}
          id="send-token"
          value={selectedSummary?.key ?? ''}
          onChange={(event) => setSelectedTokenKey(event.target.value)}
        >
          {summaries.map((summary) => (
            <option
              key={summary.key}
              value={summary.key}
            >
              {summary.tokenLabel} - {summary.totalAmount}
            </option>
          ))}
        </select>
      </label>

      <label
        className="grid gap-1 text-[0.78rem] font-semibold text-muted-foreground"
        htmlFor="send-recipient"
      >
        Recipient party
        <TextInput
          aria-label="Recipient party"
          autoComplete="off"
          id="send-recipient"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
        />
      </label>

      <label
        className="grid gap-1 text-[0.78rem] font-semibold text-muted-foreground"
        htmlFor="send-amount"
      >
        Amount
        <TextInput
          aria-label="Amount"
          id="send-amount"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>

      <label
        className="grid gap-1 text-[0.78rem] font-semibold text-muted-foreground"
        htmlFor="send-deadline"
      >
        Deadline
        <select
          aria-label="Deadline"
          className="rounded-md border border-border-strong bg-surface px-3 py-2.5 text-base text-foreground focus:border-primary focus:outline-0 focus:shadow-focus"
          id="send-deadline"
          value={deadline}
          onChange={(event) => setDeadline(event.target.value as TransferDeadline)}
        >
          {DEADLINE_OPTIONS.map((option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label
        className="grid gap-1 text-[0.78rem] font-semibold text-muted-foreground"
        htmlFor="send-memo"
      >
        Memo
        <TextInput
          aria-label="Memo"
          id="send-memo"
          value={memo}
          onChange={(event) => setMemo(event.target.value)}
        />
      </label>

      {summaries.length === 0 && !loading ? (
        <p className="m-0 rounded-md border border-border bg-surface px-3 py-3 text-[0.85rem] text-muted-foreground">
          No token holdings
        </p>
      ) : null}

      <PrimaryButton
        className="mt-1"
        disabled={
          submitting ||
          summaries.length === 0 ||
          recipient.trim() === '' ||
          amount.trim() === '' ||
          selectedSummary?.instrumentId?.id === undefined
        }
        type="submit"
      >
        {submitting ? 'Sending...' : 'Send'}
      </PrimaryButton>
    </form>
  )
}
