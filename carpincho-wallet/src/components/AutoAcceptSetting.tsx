import { useEffect, useState } from 'react'
import { Switch } from '@/components/ui/Switch'
import { Tooltip } from '@/components/ui/Tooltip'
import { toast } from '@/components/ui/toast'
import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'
import { useAmuletPreapproval } from '@/hooks/useAmuletPreapproval'
import type { AccountPublic } from '@/vault/types'
import { useVault } from '@/vault/useVault'

interface AutoAcceptSettingProps {
  account: AccountPublic
  api?: AmuletPreapprovalApi
}

const AUTO_ACCEPT_TOOLTIP =
  "When this is on, any Amulet someone sends you drops straight into your wallet. Turn it off and you'll have to accept each incoming transfer yourself."

// Receiver opt-in for Amulet auto-accept, surfaced as a setting row on the Assets tab.
export const AutoAcceptSetting = ({ account, api }: AutoAcceptSettingProps): JSX.Element => {
  const vault = useVault()
  const preapproval = useAmuletPreapproval(account, {
    api,
    signMessage: vault.signMessage,
    recordTransaction: vault.recordTransaction,
  })
  const status = preapproval.status
  const isExpired = status?.expired === true
  const isActive = status?.active === true && !isExpired
  const confirmed = isActive || isExpired

  // Optimistic: hold the requested state until polling confirms it; the ledger can lag.
  const [optimistic, setOptimistic] = useState<boolean | undefined>(undefined)
  const checked = optimistic ?? confirmed

  useEffect(() => {
    if (optimistic !== undefined && optimistic === confirmed) {
      setOptimistic(undefined)
    }
  }, [optimistic, confirmed])

  const handleToggle = async (): Promise<void> => {
    const next = !checked
    setOptimistic(next)
    try {
      if (next) {
        await preapproval.enable()
        toast.success('Amulet auto-accept enabled')
      } else {
        await preapproval.disable()
        toast.success('Amulet auto-accept disabled')
      }
    } catch (error) {
      setOptimistic(undefined)
      toast.error(error instanceof Error ? error.message : 'Amulet auto-accept failed')
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3.5 py-3.5">
      <div className="flex items-center gap-1.5">
        <h2 className="m-0 text-[0.95rem] font-semibold text-foreground">Auto-accept incoming</h2>
        <Tooltip content={AUTO_ACCEPT_TOOLTIP} />
      </div>
      <Switch
        aria-label="Auto-accept incoming"
        checked={checked}
        disabled={preapproval.busy || (preapproval.loading && status === undefined)}
        onCheckedChange={() => {
          void handleToggle()
        }}
      />
    </div>
  )
}
