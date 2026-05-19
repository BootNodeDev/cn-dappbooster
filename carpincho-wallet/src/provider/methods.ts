export const CANTON_METHOD_CONNECT = 'connect'
export const CANTON_METHOD_DISCONNECT = 'disconnect'
export const CANTON_METHOD_IS_CONNECTED = 'isConnected'
export const CANTON_METHOD_PREPARE_EXECUTE = 'prepareExecute'
export const CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT = 'prepareExecuteAndWait'
export const CANTON_METHOD_LIST_ACCOUNTS = 'listAccounts'
export const CANTON_METHOD_GET_PRIMARY_ACCOUNT = 'getPrimaryAccount'
export const CANTON_METHOD_GET_ACTIVE_NETWORK = 'getActiveNetwork'
export const CANTON_METHOD_STATUS = 'status'
export const CANTON_METHOD_LEDGER_API = 'ledgerApi'
export const CANTON_METHOD_SIGN_MESSAGE = 'signMessage'

export const LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE = 'canton_prepareSignExecute'

export type PendingApprovalMethod =
  | typeof CANTON_METHOD_SIGN_MESSAGE
  | typeof CANTON_METHOD_PREPARE_EXECUTE
  | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT

export const normalizeMethod = (method: string): string => {
  if (!method.startsWith('canton_')) {
    return method
  }
  const raw = method.slice('canton_'.length)
  const normalized = `${raw.charAt(0).toLowerCase()}${raw.slice(1)}`
  return normalized === 'prepareSignExecute' ? CANTON_METHOD_PREPARE_EXECUTE : normalized
}

export const isExecuteApprovalMethod = (
  method: string,
): method is typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT =>
  method === CANTON_METHOD_PREPARE_EXECUTE || method === CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT

export const pendingApprovalMethod = (
  rawMethod: string,
  normalizedMethod:
    | typeof CANTON_METHOD_PREPARE_EXECUTE
    | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT,
): typeof CANTON_METHOD_PREPARE_EXECUTE | typeof CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT =>
  rawMethod === LEGACY_CANTON_METHOD_PREPARE_SIGN_EXECUTE
    ? CANTON_METHOD_PREPARE_EXECUTE_AND_WAIT
    : normalizedMethod
