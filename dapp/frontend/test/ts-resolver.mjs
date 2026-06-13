// ESM loader hook: resolves extensionless local imports to .ts files
// Used by the test runner so source files can import without extension (Biome rule)
// while Node's ESM resolver can still find them.
import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !specifier.match(/\.\w+$/)) {
    const base = context.parentURL ? dirname(fileURLToPath(context.parentURL)) : process.cwd()
    const candidate = resolvePath(base, `${specifier}.ts`)
    if (existsSync(candidate)) {
      return nextResolve(pathToFileURL(candidate).href, context)
    }
  }
  return nextResolve(specifier, context)
}
