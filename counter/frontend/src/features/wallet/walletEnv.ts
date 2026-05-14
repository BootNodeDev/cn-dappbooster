const envString = (name: string): string =>
  ((import.meta.env[name] as string | undefined) ?? '').trim()

export const walletConnectProjectId = (): string => {
  const value = envString('VITE_WC_PROJECT_ID')
  if (value === '') {
    throw new Error('VITE_WC_PROJECT_ID is not set')
  }
  return value
}
