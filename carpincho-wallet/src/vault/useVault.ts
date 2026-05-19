import { useContext } from 'react'
import { VaultContext, type VaultContextValue } from '@/vault/VaultContext.tsx'

export const useVault = (): VaultContextValue => {
  const v = useContext(VaultContext)
  if (v === undefined) {
    throw new Error('useVault must be used inside <VaultProvider>')
  }
  return v
}
