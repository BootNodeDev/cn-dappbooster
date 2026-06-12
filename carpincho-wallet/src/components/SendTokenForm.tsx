import { type FormEvent, useState } from 'react'
import type { ExecutePreparedResponse } from '@/api/interactiveSubmission'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { type CreateTokenTransferParams, createTokenTransfer } from '@/cip56/transfers'
import { PrimaryButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/TextInput'
import { toast } from '@/components/ui/toast'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

export type TransferDeadline = '1h' | '1d' | '1w' | '1m' | '1y'

export interface Cip56SendApi {
  createTokenTransfer: (params: CreateTokenTransferParams) => Promise<ExecutePreparedResponse>
}

export interface SendTokenFormProps {
  account: AccountPublic
  summary: TokenHoldingSummary
  sendApi?: Cip56SendApi
  // Called after a transfer is accepted so the host can refresh holdings or navigate back.
  onSent?: () => void
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

// Outgoing CIP-56 transfer form for a token already chosen by the detail modal.
export const SendTokenForm = ({
  account,
  summary,
  sendApi = defaultSendApi,
  onSent,
}: SendTokenFormProps): JSX.Element => {
  const vault = useVault()
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [deadline, setDeadline] = useState<TransferDeadline>('1h')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)
  const [submitStatus, setSubmitStatus] = useState<string | undefined>(undefined)

  // Submits the transfer intent while Carpincho remains the signer of the prepared transaction.
  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (summary.instrumentId?.id === undefined) {
      setSubmitError('Token is missing an instrument id')
      return
    }
    setSubmitting(true)
    setSubmitError(undefined)
    setSubmitStatus(undefined)
    try {
      await sendApi.createTokenTransfer({
        account,
        recipient: recipient.trim(),
        amount: amount.trim(),
        instrumentId: summary.instrumentId,
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
      onSent?.()
    } catch (err) {
      const message = (err as Error).message
      setSubmitError(message)
      toast.error(`Send failed: ${message}`)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        void onSubmit(event)
      }}
    >
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

      <PrimaryButton
        className="mt-1"
        disabled={
          submitting ||
          recipient.trim() === '' ||
          amount.trim() === '' ||
          summary.instrumentId?.id === undefined
        }
        type="submit"
      >
        {submitting ? 'Sending...' : 'Send'}
      </PrimaryButton>
    </form>
  )
}
