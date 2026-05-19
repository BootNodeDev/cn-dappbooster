import { useEffect, useState } from 'react'
import { walletServiceRequest } from '@/api/walletService.ts'
import { GhostButton, PrimaryButton, SecondaryButton } from '@/components/ui/Button.tsx'
import { TextInput } from '@/components/ui/TextInput.tsx'
import { toast } from '@/components/ui/toast.ts'
import type { RuntimeConfig } from '@/config/runtimeConfig.ts'
import { useRuntimeConfig } from '@/config/useRuntimeConfig.ts'

interface WalletServiceStatus {
  connection?: {
    isNetworkConnected?: boolean
    networkReason?: string
  }
  network?: {
    networkId?: string
  }
}

export const ConnectionSettingsView = (): JSX.Element => {
  const { config, saveConfig } = useRuntimeConfig()
  const [draft, setDraft] = useState<RuntimeConfig>(config)
  const [busy, setBusy] = useState(false)

  useEffect(() => setDraft(config), [config])

  const onSave = (): void => {
    const saved = saveConfig(draft)
    setDraft(saved)
    toast.success('Saved.')
  }

  const onTest = async (): Promise<void> => {
    setBusy(true)
    try {
      const status = await walletServiceRequest<WalletServiceStatus>('status', undefined, {
        rpcUrl: draft.walletServiceRpcUrl,
      })
      const network = status.network?.networkId ?? 'unknown network'
      const connected = status.connection?.isNetworkConnected === true
      const reason = status.connection?.networkReason
      if (connected) {
        toast.success(`wallet-service reachable: ${network}`)
      } else {
        toast.warning(`wallet-service responded, Canton not connected: ${reason ?? network}`)
      }
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 pt-1">
      <div className="flex items-center justify-end">
        <GhostButton onClick={() => setDraft(config)}>Reset</GhostButton>
      </div>

      <div>
        <label htmlFor="wallet-service-rpc">Wallet-service RPC URL</label>
        <TextInput
          id="wallet-service-rpc"
          type="url"
          className="font-mono"
          value={draft.walletServiceRpcUrl}
          onChange={(e) => setDraft((prev) => ({ ...prev, walletServiceRpcUrl: e.target.value }))}
          placeholder="http://localhost:3010/rpc"
        />
      </div>

      <div>
        <label htmlFor="canton-network">WalletConnect Canton network</label>
        <TextInput
          id="canton-network"
          type="text"
          className="font-mono"
          value={draft.cantonNetwork}
          onChange={(e) => setDraft((prev) => ({ ...prev, cantonNetwork: e.target.value }))}
          placeholder="canton:local"
        />
      </div>

      <div className="flex gap-3 mt-1">
        <PrimaryButton onClick={onSave}>Save</PrimaryButton>
        <SecondaryButton
          onClick={() => {
            void onTest()
          }}
          disabled={busy}
        >
          {busy ? 'Testing…' : 'Test wallet-service'}
        </SecondaryButton>
      </div>
    </section>
  )
}
