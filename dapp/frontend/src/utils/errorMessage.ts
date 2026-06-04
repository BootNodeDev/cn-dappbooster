// Turn an unknown throwable into a human-readable string. Ledger/RPC rejections
// are often plain objects (Canton's `{ cause, code, ... }`) or Errors whose
// `.message` is a useless "[object Object]" with the real detail in `.cause`.
const readable = (value: unknown, depth = 0): string | undefined => {
  if (typeof value === 'string') {
    const text = value.trim()
    return text.length > 0 && text !== '[object Object]' ? text : undefined
  }
  if (value === null || typeof value !== 'object' || depth > 4) {
    return undefined
  }
  const record = value as Record<string, unknown>
  return (
    readable(record.cause, depth + 1) ??
    readable(record.message, depth + 1) ??
    readable(record.error, depth + 1) ??
    readable(record.reason, depth + 1) ??
    safeStringify(record)
  )
}

const safeStringify = (record: Record<string, unknown>): string | undefined => {
  try {
    const json = JSON.stringify(record)
    return json !== undefined && json !== '{}' ? json : undefined
  } catch {
    return undefined
  }
}

export const errorMessage = (err: unknown): string => readable(err) ?? 'Unexpected error'
