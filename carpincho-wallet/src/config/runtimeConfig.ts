export interface RuntimeConfig {
  walletServiceRpcUrl: string
  cantonNetwork: string
}

const STORAGE_KEY = 'carpincho.runtime-config.v1'

const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  walletServiceRpcUrl: 'http://localhost:3010/rpc',
  cantonNetwork: 'canton:local',
}

export const defaultRuntimeConfig = (): RuntimeConfig => ({
  ...DEFAULT_RUNTIME_CONFIG,
})

const sanitizeRuntimeConfig = (raw: Partial<RuntimeConfig>): RuntimeConfig => {
  const defaults = defaultRuntimeConfig()
  return {
    walletServiceRpcUrl: raw.walletServiceRpcUrl?.trim() ?? defaults.walletServiceRpcUrl,
    cantonNetwork: raw.cantonNetwork?.trim() ?? defaults.cantonNetwork,
  }
}

export const loadRuntimeConfig = (): RuntimeConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      return defaultRuntimeConfig()
    }
    return sanitizeRuntimeConfig(JSON.parse(stored) as Partial<RuntimeConfig>)
  } catch {
    return defaultRuntimeConfig()
  }
}

export const saveRuntimeConfig = (config: RuntimeConfig): RuntimeConfig => {
  const sanitized = sanitizeRuntimeConfig(config)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  window.dispatchEvent(new CustomEvent('carpincho-runtime-config-changed', { detail: sanitized }))
  return sanitized
}

export const subscribeRuntimeConfig = (listener: (config: RuntimeConfig) => void): (() => void) => {
  const onStorage = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      listener(loadRuntimeConfig())
    }
  }
  const onCustom = (event: Event): void => {
    listener((event as CustomEvent<RuntimeConfig>).detail)
  }
  window.addEventListener('storage', onStorage)
  window.addEventListener('carpincho-runtime-config-changed', onCustom)
  return () => {
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('carpincho-runtime-config-changed', onCustom)
  }
}
