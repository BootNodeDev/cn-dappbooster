export default {
  '{carpincho-wallet,canton-connect-kit,counter/frontend}/**/*.{ts,tsx,js,jsx,json,jsonc,mjs,cjs,css}':
    'biome check --write --no-errors-on-unmatched',
  'carpincho-wallet/src/**/*.{ts,tsx,js,jsx}': () => 'npm --prefix carpincho-wallet test',
  'canton-connect-kit/src/**/*.{ts,tsx,js,jsx}': () => 'npm --prefix canton-connect-kit test',
}
