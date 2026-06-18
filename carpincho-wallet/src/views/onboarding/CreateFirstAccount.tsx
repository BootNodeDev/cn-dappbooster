import { useState } from 'react'
import { ConnectionFooter, type DappFooterStatus } from '@/components/ConnectionFooter'
import { CreateAccountForm } from '@/components/CreateAccountForm'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { useWalletServiceStatus } from '@/hooks/useWalletServiceStatus'
import { ConnectionSettingsView } from '@/views/ConnectionSettingsView'

const NO_DAPP: DappFooterStatus = { kind: 'none' }

// Renders first-account creation with the same wallet-service controls available after setup.
export const CreateFirstAccount = (): JSX.Element => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const walletService = useWalletServiceStatus()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CreateAccountForm showIntro />
      </Card>

      <Sheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Connection"
        description="Configure wallet-service URL and network."
      >
        <ConnectionSettingsView />
      </Sheet>

      <ConnectionFooter
        walletService={walletService}
        dapp={NO_DAPP}
        onOpenSettings={() => setSettingsOpen(true)}
      />
    </div>
  )
}
