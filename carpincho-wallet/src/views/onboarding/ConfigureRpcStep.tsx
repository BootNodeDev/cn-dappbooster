import { useEffect, useState } from 'react'
import { PrimaryButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ALERT_CIRCLE_ICON, SPINNER_ICON } from '@/components/ui/icons'
import { TextInput } from '@/components/ui/TextInput'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useWalletServiceTest } from '@/hooks/useWalletServiceTest'
import { cn } from '@/utils/cn'

const DEBOUNCE_MS = 450
const RETRY_MS = 3000

export interface ConfigureRpcStepProps {
  onConfirmed: () => void
}

export const ConfigureRpcStep = ({ onConfirmed }: ConfigureRpcStepProps): JSX.Element => {
  const { config, saveConfig } = useRuntimeConfig()
  const [url, setUrl] = useState(config.walletServiceRpcUrl)
  const { state, networkId, reason, testedUrl, test } = useWalletServiceTest()

  // Probe on mount and (debounced) whenever the URL changes.
  useEffect(() => {
    const id = window.setTimeout(() => {
      void test(url)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [url, test])

  // Auto-retry while unreachable so the step unblocks once wallet-service comes up.
  useEffect(() => {
    if (state !== 'unreachable') {
      return undefined
    }
    const id = window.setInterval(() => {
      void test(url)
    }, RETRY_MS)
    return () => window.clearInterval(id)
  }, [state, url, test])

  const canContinue = state === 'connected' && testedUrl === url
  const network = networkId?.replace(/^canton:/, '')

  const onContinue = (): void => {
    saveConfig({ ...config, walletServiceRpcUrl: url })
    onConfirmed()
  }

  return (
    <Card>
      <label htmlFor="rpc-url">Wallet-service RPC URL</label>
      <TextInput
        id="rpc-url"
        type="url"
        className="font-mono"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="http://localhost:3010/rpc"
      />

      <div
        role="status"
        className={cn(
          'mt-3 flex items-center gap-2.5 rounded-md px-3 py-2.5 text-[0.85rem] font-semibold',
          state === 'connected' && 'bg-success-soft text-success',
          state === 'unreachable' && 'items-start bg-danger-soft text-danger',
          state !== 'connected' && state !== 'unreachable' && 'bg-muted text-soft',
        )}
      >
        {state === 'connected' && (
          <>
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full bg-success"
            />
            <span>wallet-service reachable</span>
            {network !== undefined && (
              <span className="ml-auto rounded-full border border-success/40 bg-surface px-2 py-0.5 font-mono text-[0.76rem] text-success">
                {network}
              </span>
            )}
          </>
        )}
        {state === 'unreachable' && (
          <>
            <span className="shrink-0 [&>svg]:size-4">{ALERT_CIRCLE_ICON}</span>
            <span className="flex flex-col gap-0.5">
              <span>Can't reach wallet-service</span>
              {reason !== undefined && (
                <span className="text-[0.78rem] font-normal opacity-85">
                  {reason} — retrying automatically…
                </span>
              )}
            </span>
          </>
        )}
        {state !== 'connected' && state !== 'unreachable' && (
          <>
            <span className="shrink-0 [&>svg]:size-4">{SPINNER_ICON}</span>
            <span>Checking connection…</span>
          </>
        )}
      </div>

      <PrimaryButton
        className="w-full mt-6"
        data-testid="configure-rpc-continue"
        disabled={!canContinue}
        onClick={onContinue}
      >
        Continue
      </PrimaryButton>
    </Card>
  )
}
