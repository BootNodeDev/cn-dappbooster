import type { ExecutePreparedResponse } from '@/api/interactiveSubmission'
import { compareDecimalStrings } from '@/cip56/amount'
import type { TokenHoldingSummary } from '@/cip56/holdings'
import { type CreateTokenTransferParams, createTokenTransfer } from '@/cip56/transfers'
import { AmountField } from '@/components/AmountField'
import { PrimaryButton } from '@/components/ui/Button'
import { CONTACTS_ICON } from '@/components/ui/icons'
import { Select } from '@/components/ui/Select'
import { TextInput } from '@/components/ui/TextInput'
import { Tooltip } from '@/components/ui/Tooltip'

export type TransferDeadline = '1h' | '1d' | '1w' | '1m' | '1y'

export interface Cip56SendApi {
  createTokenTransfer: (params: CreateTokenTransferParams) => Promise<ExecutePreparedResponse>
}

export const defaultSendApi: Cip56SendApi = { createTokenTransfer }

export const DEADLINE_OPTIONS: Array<{ value: TransferDeadline; label: string }> = [
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

const MEMO_HELP =
  "A short note that rides along with the transfer, like the reference line on a bank payment. The recipient can read it. Leave it blank if you don't need one."

export interface SendTokenFormProps {
  summary: TokenHoldingSummary
  spendableBalance: string
  recipient: string
  amount: string
  memo: string
  deadline: TransferDeadline
  onRecipientChange: (value: string) => void
  onAmountChange: (value: string) => void
  onMemoChange: (value: string) => void
  onDeadlineChange: (value: TransferDeadline) => void
  onOpenContacts: () => void
  onReview: () => void
}

// True when amount is a positive decimal not exceeding the spendable balance.
const amountIsValid = (amount: string, balance: string): boolean => {
  if (compareDecimalStrings(amount, '0') !== 1) {
    return false
  }
  return compareDecimalStrings(amount, balance) !== 1
}

// Send screen body: controlled fields preset to one token; advances to confirmation via Review.
export const SendTokenForm = ({
  summary,
  spendableBalance,
  recipient,
  amount,
  memo,
  deadline,
  onRecipientChange,
  onAmountChange,
  onMemoChange,
  onDeadlineChange,
  onOpenContacts,
  onReview,
}: SendTokenFormProps): JSX.Element => {
  const trimmedAmount = amount.trim()
  const overBalance =
    trimmedAmount !== '' && compareDecimalStrings(trimmedAmount, spendableBalance) === 1
  const canReview =
    recipient.trim() !== '' &&
    amountIsValid(trimmedAmount, spendableBalance) &&
    summary.instrumentId?.id !== undefined

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1">
        <div className="flex items-center justify-between">
          <label
            className="text-[0.78rem] font-semibold text-muted-foreground"
            htmlFor="send-recipient"
          >
            Recipient
          </label>
          <button
            type="button"
            aria-label="Contacts"
            onClick={onOpenContacts}
            className="inline-flex items-center justify-center rounded-sm text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:shadow-focus"
          >
            {CONTACTS_ICON}
          </button>
        </div>
        <TextInput
          aria-label="Recipient"
          autoComplete="off"
          id="send-recipient"
          value={recipient}
          onChange={(event) => onRecipientChange(event.target.value)}
        />
      </div>

      <AmountField
        value={amount}
        onChange={onAmountChange}
        onMax={() => onAmountChange(spendableBalance)}
        balance={spendableBalance}
        tokenLabel={summary.tokenLabel}
        error={overBalance}
      />

      <div className="grid gap-1">
        <label
          className="text-[0.78rem] font-semibold text-muted-foreground"
          htmlFor="send-deadline"
        >
          Deadline
        </label>
        <Select
          id="send-deadline"
          ariaLabel="Deadline"
          value={deadline}
          onValueChange={(value) => onDeadlineChange(value as TransferDeadline)}
          options={DEADLINE_OPTIONS}
        />
      </div>

      <div className="grid gap-1">
        <span className="flex items-center gap-1.5 text-[0.78rem] font-semibold text-muted-foreground">
          Memo
          <Tooltip
            label="What is a memo?"
            content={MEMO_HELP}
          />
        </span>
        <TextInput
          aria-label="Memo"
          id="send-memo"
          value={memo}
          onChange={(event) => onMemoChange(event.target.value)}
        />
      </div>

      <PrimaryButton
        className="mt-1"
        disabled={!canReview}
        onClick={onReview}
      >
        Review
      </PrimaryButton>
    </div>
  )
}
