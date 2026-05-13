import { useCallback, useEffect, useState } from 'react'
import {
  loadRuntimeConfig,
  saveRuntimeConfig,
  subscribeRuntimeConfig,
  type RuntimeConfig
} from './runtimeConfig.js'

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
