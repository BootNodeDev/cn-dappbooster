import type { PendingApprovalMethod } from '@/provider/methods.ts'
import type { AccountPublic } from '@/vault/types.ts'

export interface ProviderRequest {
  method: string
  params?: unknown
}

export interface ProviderResponder {
  result: (value: unknown) => Promise<void>
  error: (code: number, message: string) => Promise<void>
}

export type AccountResolver = () => {
  accounts: AccountPublic[]
  primary: AccountPublic | null
}

export interface DispatchResult {
  status: 'handled' | 'pending-approval' | 'error'
  pendingMethod?: PendingApprovalMethod
}
