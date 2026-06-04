import { type FormEvent, useState } from 'react'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { PrimaryButton } from '@/components/ui/Button'
import { OptionList } from '@/components/ui/OptionList'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { toast } from '@/components/ui/toast'
import type { AutoLockOption } from '@/vault/storage'
import { useVault } from '@/vault/useVault'

const AUTO_LOCK_LABELS: Array<{ value: AutoLockOption; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
]

interface VerifyState {
  phase: 'verify'
  current: string
  error: string | null
}

interface ChangeState {
  phase: 'change'
  current: string
  next: string
  confirm: string
  valid: boolean
}

type PasswordState = VerifyState | ChangeState

const initialState = (): VerifyState => ({ phase: 'verify', current: '', error: null })

export const PasswordForm = (): JSX.Element => {
  const v = useVault()
  const [state, setState] = useState<PasswordState>(initialState)

  const onSubmitVerify = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault()
    if (state.phase !== 'verify') return
    if (!v.verifyPassword(state.current)) {
      setState({ ...state, error: 'Incorrect password.' })
      return
    }
    setState({ phase: 'change', current: state.current, next: '', confirm: '', valid: false })
  }

  const onSubmitChange = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault()
    if (state.phase !== 'change') return
    if (!state.valid) return
    try {
      await v.changePassword(state.current, state.next)
      setState(initialState())
      toast.success('Password updated.')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not change password.'
      setState({ phase: 'verify', current: '', error: msg })
    }
  }

  if (state.phase === 'verify') {
    const hasError = state.error !== null
    return (
      <form
        onSubmit={onSubmitVerify}
        className="flex flex-col gap-3"
      >
        <PasswordInput
          aria-label="Current password"
          aria-errormessage={hasError ? 'current-password-error' : undefined}
          placeholder="Current password"
          autoComplete="current-password"
          error={hasError}
          value={state.current}
          onChange={(e) => setState({ ...state, current: e.target.value, error: null })}
        />
        {hasError && (
          <p
            id="current-password-error"
            className="text-[0.85rem] text-danger"
          >
            {state.error}
          </p>
        )}
        <PrimaryButton type="submit">Continue</PrimaryButton>
      </form>
    )
  }

  return (
    <form
      onSubmit={onSubmitChange}
      className="flex flex-col gap-3"
    >
      <NewPasswordFields
        confirm={state.confirm}
        onConfirmChange={(value) => setState({ ...state, confirm: value })}
        onPasswordChange={(value) => setState({ ...state, next: value })}
        onValidityChange={(valid) => setState((s) => (s.phase === 'change' ? { ...s, valid } : s))}
        password={state.next}
      />
      <PrimaryButton
        disabled={!state.valid}
        type="submit"
      >
        Change password
      </PrimaryButton>
    </form>
  )
}

export const AutoLockList = (): JSX.Element => {
  const v = useVault()
  return (
    <OptionList
      options={AUTO_LOCK_LABELS}
      value={v.autoLockOption}
      onSelect={v.setAutoLockOption}
    />
  )
}
