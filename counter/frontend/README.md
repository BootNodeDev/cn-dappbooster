# Counter Frontend

Standalone React dApp for the Counter DAR.

The frontend knows the Counter template and choices. It talks only to Carpincho through WalletConnect/CIP-0103:

```text
frontend -> WalletConnect -> carpincho-wallet -> wallet-service -> Canton participant
```

## Run

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

`VITE_WC_PROJECT_ID` must be a WalletConnect/Reown project id.

The Canton network and Carpincho URL are configured from the app UI and stored in browser `localStorage`. Defaults:

- Canton network: `canton:local`
- Carpincho URL: `http://localhost:3011`

The active Carpincho account must already have a Canton party on the participant.

If the DAML changes and the DAR gets a new package id, update `src/counterSignature.ts`.
