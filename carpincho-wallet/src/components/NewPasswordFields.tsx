import { useEffect, useId, useRef } from 'react'
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator.tsx'
import { PasswordInput } from '@/components/ui/PasswordInput.tsx'
import {
  isConfirmMismatch,
  isNewPasswordPairValid,
  usePasswordStrengthReady,
} from '@/vault/passwordStrength.ts'

type Props = {
  password: string
  confirm: string
  onPasswordChange: (value: string) => void
  onConfirmChange: (value: string) => void
  onValidityChange: (valid: boolean) => void
  passwordLabel?: string
  confirmLabel?: string
  labelMode?: 'visible' | 'aria'
}

export const NewPasswordFields = ({
  password,
  confirm,
  onPasswordChange,
  onConfirmChange,
  onValidityChange,
  passwordLabel = 'New password',
  confirmLabel = 'Confirm new password',
  labelMode = 'aria',
}: Props): JSX.Element => {
  usePasswordStrengthReady()
  const passwordId = useId()
  const confirmId = useId()
  const strengthId = useId()
  const valid = isNewPasswordPairValid(password, confirm)
  const visible = labelMode === 'visible'
  const lastReported = useRef<boolean | null>(null)

  useEffect(() => {
    if (lastReported.current === valid) return
    lastReported.current = valid
    onValidityChange(valid)
  }, [valid, onValidityChange])

  return (
    <>
      <div className="flex flex-col gap-1">
        <div>
          {visible && <label htmlFor={passwordId}>{passwordLabel}</label>}
          <PasswordInput
            aria-describedby={strengthId}
            aria-label={visible ? undefined : passwordLabel}
            autoComplete="new-password"
            id={visible ? passwordId : undefined}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder={visible ? undefined : passwordLabel}
            value={password}
          />
        </div>
        <PasswordStrengthIndicator
          id={strengthId}
          password={password}
        />
      </div>
      <div>
        {visible && <label htmlFor={confirmId}>{confirmLabel}</label>}
        <PasswordInput
          aria-label={visible ? undefined : confirmLabel}
          autoComplete="new-password"
          error={isConfirmMismatch(password, confirm)}
          id={visible ? confirmId : undefined}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder={visible ? undefined : confirmLabel}
          value={confirm}
        />
      </div>
    </>
  )
}
