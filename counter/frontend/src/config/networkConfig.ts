export interface NetworkConfig {
  cantonNetwork: string
}

const STORAGE_KEY = 'counter.frontend.network-config.v1'

const DEFAULT_NETWORK_CONFIG: NetworkConfig = {
  cantonNetwork: 'canton:local'
}

export const defaultNetworkConfig = (): NetworkConfig => ({
  ...DEFAULT_NETWORK_CONFIG
})

const normalizeNetwork = (value: string): string => {
  const trimmed = value.trim()
  if (trimmed === '') {
    return DEFAULT_NETWORK_CONFIG.cantonNetwork
  }
  return trimmed.startsWith('canton:') ? trimmed : `canton:${trimmed}`
}

const sanitizeNetworkConfig = (raw: Partial<NetworkConfig>): NetworkConfig => ({
  cantonNetwork: normalizeNetwork(raw.cantonNetwork ?? DEFAULT_NETWORK_CONFIG.cantonNetwork)
})

export const loadNetworkConfig = (): NetworkConfig => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) {
      return defaultNetworkConfig()
    }
    return sanitizeNetworkConfig(JSON.parse(stored) as Partial<NetworkConfig>)
  } catch {
    return defaultNetworkConfig()
  }
}

export const saveNetworkConfig = (config: NetworkConfig): NetworkConfig => {
  const sanitized = sanitizeNetworkConfig(config)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized))
  return sanitized
}
