// Normalizes execution params so every prepare request has the active party and read parties Canton expects.
export const executeParams = (params: unknown, partyId: string): Record<string, unknown> => {
  const base =
    typeof params === 'object' && params !== null && !Array.isArray(params)
      ? (params as Record<string, unknown>)
      : {}
  const actAs = Array.isArray(base.actAs) && base.actAs.length > 0 ? base.actAs : [partyId]
  return {
    ...base,
    partyId,
    actAs,
    readAs: Array.isArray(base.readAs) ? base.readAs : actAs,
  }
}

// Extracts the original dApp commands that Activity can later render as a readable audit payload.
export const transactionCommands = (params: Record<string, unknown>): unknown[] | undefined => {
  const commands = params.commands
  return Array.isArray(commands) ? commands : undefined
}

// Counts original dApp commands without assuming a specific DAML command shape.
export const commandCount = (params: Record<string, unknown>): number | undefined => {
  const commands = transactionCommands(params)
  return commands?.length
}

// Produces the short Activity row summary from the first original dApp command.
export const commandSummary = (params: Record<string, unknown>): string => {
  const commands = transactionCommands(params)
  if (commands === undefined || commands.length === 0) {
    return 'Canton transaction'
  }
  const first = commands[0]
  if (typeof first !== 'object' || first === null || Array.isArray(first)) {
    return `${commands.length} command${commands.length === 1 ? '' : 's'}`
  }
  const [kind] = Object.keys(first)
  if (kind === undefined) {
    return `${commands.length} command${commands.length === 1 ? '' : 's'}`
  }
  return commands.length === 1 ? kind : `${kind} + ${commands.length - 1} more`
}

// Keeps optional string fields out of persisted activity when the dApp sent empty values.
export const optionalString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined
