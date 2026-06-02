# Counter Frontend

Standalone React dApp for the Counter DAR.

The frontend knows the Counter template and choices. It talks only to Carpincho through the injected CIP-0103 provider by default, with WalletConnect available as an optional fallback:

```text
frontend -> injected CIP-0103 provider -> carpincho-wallet -> wallet-service -> Canton participant
```

## Run

```bash
npm install
npm run dev
```

For the optional WalletConnect fallback, copy `.env.local.example` to `.env.local` and set `VITE_WC_PROJECT_ID` to a WalletConnect/Reown project id.

The Canton network and Carpincho URL are configured from the app UI and stored in browser `localStorage`. Defaults:

- Canton network: `canton:local`
- Carpincho URL: `http://localhost:3011`

The active Carpincho account must already have a Canton party on the participant.

If the DAML changes and the DAR gets a new package id, update `src/counterSignature.ts`.
