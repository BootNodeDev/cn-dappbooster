import { useCallback, useEffect, useState } from 'react'
import {
  loadRuntimeConfig,
  type RuntimeConfig,
  saveRuntimeConfig,
  subscribeRuntimeConfig,
} from '@/config/runtimeConfig'

export const useRuntimeConfig = (): {
  config: RuntimeConfig
  saveConfig: (config: RuntimeConfig) => RuntimeConfig
} => {
  const [config, setConfig] = useState<RuntimeConfig>(() => loadRuntimeConfig())

  useEffect(() => subscribeRuntimeConfig(setConfig), [])

  const saveConfig = useCallback((next: RuntimeConfig): RuntimeConfig => {
    const saved = saveRuntimeConfig(next)
    setConfig(saved)
    return saved
  }, [])

  return { config, saveConfig }
}
