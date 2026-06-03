import { useState } from 'react'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { PrimaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import { useVault } from '@/vault/useVault'

export const CreateVault = (): JSX.Element => {
  const v = useVault()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [isWorking, setIsWorking] = useState(false)
  const [passwordValid, setPasswordValid] = useState(false)

  const canSubmit = passwordValid && acknowledged

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!canSubmit) return
    setIsWorking(true)
    try {
      await v.setup(password)
    } catch (err) {
      toast.error(`Vault setup failed: ${(err as Error).message}`)
    } finally {
      setIsWorking(false)
    }
  }

  return (
    <Card className="mb-3">
      <p className="text-soft text-[1rem] mb-5 leading-relaxed flex items-center gap-2">
        Choose a strong password
        <Tooltip
          content={
            <>
              Your password encrypts your private keys locally with{' '}
              <span className="font-mono">AES-GCM</span>. It never leaves this device and{' '}
              <b>cannot be recovered</b>.
            </>
          }
          label="What is the password for?"
        />
      </p>
      <form
        className="flex flex-col gap-4"
        onSubmit={onSubmit}
      >
        <NewPasswordFields
          confirm={confirm}
          confirmLabel="Confirm password"
          confirmTestId="setup-confirm"
          labelMode="visible"
          onConfirmChange={setConfirm}
          onPasswordChange={setPassword}
          onValidityChange={setPasswordValid}
          password={password}
          passwordLabel="Password"
          passwordTestId="setup-password"
        />
        <label
          className="flex items-start gap-2.5 rounded-sm border border-border bg-muted p-2 text-[0.85rem] leading-snug text-soft cursor-pointer"
          htmlFor="ack"
        >
          <input
            id="ack"
            type="checkbox"
            checked={acknowledged}
            data-testid="setup-accept-warning"
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 shrink-0 accent-primary"
          />
          <span>
            I understand that if I lose my password, <b>it can't be recovered</b>.
          </span>
        </label>
        <PrimaryButton
          className="w-full mt-10"
          data-testid="setup-create-vault"
          disabled={isWorking || !canSubmit}
          type="submit"
        >
          {isWorking ? 'Encrypting...' : 'Create'}
        </PrimaryButton>
      </form>
    </Card>
  )
}
