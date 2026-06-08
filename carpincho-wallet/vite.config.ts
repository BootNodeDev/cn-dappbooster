import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Single source of truth: the monorepo root package.json drives the extension
// version everywhere (manifest + runtime provider). Bump it with `npm version`.
const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')) as {
  version: string
}
const appVersion = rootPkg.version
// Chrome manifest versions are 1-4 dot-separated integers; drop any semver
// prerelease/build metadata (e.g. 1.2.0-rc.1 -> 1.2.0).
const manifestVersion = appVersion.split(/[-+]/)[0]

const injectManifestVersion = (): Plugin => ({
  name: 'carpincho-manifest-version',
  apply: 'build',
  closeBundle() {
    const manifestPath = resolve(__dirname, 'dist-extension/manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.version = manifestVersion
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  },
})

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension'

  return {
    base: isExtension ? './' : '/',
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    plugins: [tailwindcss(), react(), ...(isExtension ? [injectManifestVersion()] : [])],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: isExtension ? 'dist-extension' : 'dist',
      rollupOptions: isExtension
        ? {
            input: {
              app: resolve(__dirname, 'index.html'),
              contentScript: resolve(__dirname, 'src/extension/contentScript.ts'),
              background: resolve(__dirname, 'src/extension/background.ts'),
            },
            output: {
              entryFileNames: (chunk) =>
                chunk.name === 'contentScript' || chunk.name === 'background'
                  ? '[name].js'
                  : 'assets/[name]-[hash].js',
            },
          }
        : undefined,
    },
    server: {
      host: 'localhost',
      port: 3011,
      strictPort: true,
    },
  }
})
