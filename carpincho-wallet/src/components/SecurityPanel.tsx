import { type FormEvent, useState } from 'react'
import { ConfirmPasswordForm } from '@/components/ConfirmPasswordForm'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { PrimaryButton } from '@/components/ui/Button'
import { OptionList } from '@/components/ui/OptionList'
import { toast } from '@/components/ui/toast'
import type { AutoLockOption } from '@/vault/storage'
import { useVault } from '@/vault/useVault'

const AUTO_LOCK_LABELS: Array<{ value: AutoLockOption; label: string }> = [
  { value: 'never', label: 'Never' },
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '1h', label: '1 hour' },
]

type PasswordState =
  | { phase: 'verify'; error: string | null }
  | { phase: 'change'; current: string; next: string; confirm: string; valid: boolean }

const initialState = (): PasswordState => ({ phase: 'verify', error: null })

export const PasswordForm = (): JSX.Element => {
  const v = useVault()
  const [state, setState] = useState<PasswordState>(initialState)

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
      setState({ phase: 'verify', error: msg })
    }
  }

  if (state.phase === 'verify') {
    return (
      <ConfirmPasswordForm
        label="Current password"
        submitLabel="Continue"
        initialError={state.error}
        onVerified={(current) =>
          setState({ phase: 'change', current, next: '', confirm: '', valid: false })
        }
      />
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
