const stripPrefix = (files, prefix) =>
  files.map(f => f.replace(new RegExp(`.*/${prefix}/`), ''))

export default {
  'carpincho-wallet/src/**/*.{ts,tsx,js,jsx}': files => {
    const rels = stripPrefix(files, 'carpincho-wallet')
    return [
      `cd carpincho-wallet && biome check --write --no-errors-on-unmatched ${rels.join(' ')}`,
      'npm --prefix carpincho-wallet test',
    ]
  },
  'carpincho-wallet/src/**/*.{json,jsonc,mjs,cjs}': files => {
    const rels = stripPrefix(files, 'carpincho-wallet')
    return [`cd carpincho-wallet && biome check --write --no-errors-on-unmatched ${rels.join(' ')}`]
  },
  'counter/frontend/src/**/*.{ts,tsx,js,jsx}': files => {
    const rels = stripPrefix(files, 'counter/frontend')
    return [`cd counter/frontend && eslint --fix ${rels.join(' ')}`]
  },
}
