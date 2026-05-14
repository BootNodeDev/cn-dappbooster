export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const errorData = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { raw: String(error) }
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    cause: error.cause
  }
}
