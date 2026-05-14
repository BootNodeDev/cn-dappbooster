export const objectParam = <T>(params: unknown, name: string): T => {
  if (typeof params !== 'object' || params === null || Array.isArray(params)) {
    throw new Error(`${name} params must be an object`)
  }
  return params as T
}
