import { useState } from 'react'
import type { AmuletTapApi } from '@/cip56/amuletPreapproval'
import { DarUploadPanel } from '@/components/DarUploadPanel'
import { Alert } from '@/components/ui/Alert'
import { ActiveContractsUtil } from '@/components/utils/ActiveContractsUtil'
import { CreateContractUtil } from '@/components/utils/CreateContractUtil'
import { ExerciseChoiceUtil } from '@/components/utils/ExerciseChoiceUtil'
import { UtilDetail } from '@/components/utils/UtilDetail'
import { type UtilKey, UtilsList } from '@/components/utils/UtilsList'
import { createContract, exerciseContract, listActiveContracts } from '@/ledger/contracts'
import type { AccountPublic } from '@/vault/types'

export interface UtilsApi {
  createContract: typeof createContract
  exerciseContract: typeof exerciseContract
  listActiveContracts: typeof listActiveContracts
}

const defaultApi: UtilsApi = { createContract, exerciseContract, listActiveContracts }

const UTIL_TITLES: Record<UtilKey, string> = {
  create: 'Create contract',
  exercise: 'Exercise choice',
  contracts: 'Active contracts',
  dar: 'Upload DAR',
}

interface UtilsPanelProps {
  account?: AccountPublic
  api?: UtilsApi
  tapApi?: AmuletTapApi
}

// Master/detail dev tools: a util list that drills into one util at a time.
export const UtilsPanel = ({ account, api = defaultApi, tapApi }: UtilsPanelProps): JSX.Element => {
  const [selected, setSelected] = useState<UtilKey | null>(null)

  if (account === undefined) {
    return (
      <section className="px-1 py-2">
        <Alert variant="warning">Create an account before using ledger tools.</Alert>
      </section>
    )
  }

  if (selected === null) {
    return (
      <UtilsList
        account={account}
        tapApi={tapApi}
        onSelect={setSelected}
      />
    )
  }

  return (
    <UtilDetail
      title={UTIL_TITLES[selected]}
      onBack={() => setSelected(null)}
    >
      {selected === 'create' && (
        <CreateContractUtil
          account={account}
          createContract={api.createContract}
        />
      )}
      {selected === 'exercise' && (
        <ExerciseChoiceUtil
          account={account}
          exerciseContract={api.exerciseContract}
        />
      )}
      {selected === 'contracts' && (
        <ActiveContractsUtil
          account={account}
          listActiveContracts={api.listActiveContracts}
        />
      )}
      {selected === 'dar' && <DarUploadPanel />}
    </UtilDetail>
  )
}
