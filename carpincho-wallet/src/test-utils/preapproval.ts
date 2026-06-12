import type { AmuletPreapprovalApi } from '@/hooks/useAmuletPreapproval'

// Keeps the auto-accept toggle inert for scenarios that do not exercise it.
export const inactivePreapprovalApi: AmuletPreapprovalApi = {
  getAmuletPreapprovalStatus: async () => ({ active: false, expired: false }),
  createAmuletPreapproval: async () => ({ updateId: 'noop' }),
  cancelAmuletPreapproval: async () => ({ updateId: 'noop' }),
}
