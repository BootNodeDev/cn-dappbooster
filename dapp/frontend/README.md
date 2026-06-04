# dApp Frontend (starter)

A minimal React dApp shell built on `canton-connect-kit`. `App.tsx` wires the
`ConnectKitProvider` and a `ConnectionBar` (connect via the Carpincho extension
or WalletConnect, account/lock handling) around a workspace that renders your
feature components only when the wallet is connected and unlocked.

It talks to Carpincho through the injected CIP-0103 provider by default, with
WalletConnect available as an optional fallback:

```text
frontend -> injected CIP-0103 provider -> carpincho-wallet -> wallet-service -> Canton participant
```

Two demo features ship under `src/features/` (`counter`, `sign-message`) and are
meant to be deleted once you start building your own app.

## Run

For the full local stack, follow the root [quick start](../../README.md#quick-start).
This package can also run by itself against the configured wallet URL:

```bash
npm install
npm run dev
```

For the optional WalletConnect fallback, copy `.env.local.example` to `.env.local`
and set `VITE_WC_PROJECT_ID` to a WalletConnect/Reown project id.

The Canton network and Carpincho URL are read from `localStorage`. Defaults:

- Canton network: `canton:local`
- Carpincho URL: `http://localhost:3011`

The active Carpincho account must already have a Canton party on the participant.

## Project shape

```text
src/
  App.tsx                provider + <ConnectionBar> wrapping the feature slots
  ConnectionBar.tsx      wallet connectivity: connect/lock UX + workspace gate
  index.css              shell + base styles
  runtimeConfig.ts       network / wallet URL (localStorage)
  utils/formatPartyId.ts shared party-id formatter
  features/
    counter/             demo feature (DAML-backed counter) — removable
    sign-message/        demo feature (CIP-0103 signMessage)  — removable
```

A feature folder is self-contained: its component, styles, unit test, and DAML
signature (counter only) live together, and it is wired into the app by a single
import + render line in `App.tsx`.

## Removing a feature

Each `src/features/<name>/` folder is a removable demo. To drop one:

1. Delete `src/features/<name>/`.
2. Delete its `import` and its `<…/>` line in `src/App.tsx`.
3. Delete its e2e specs at `../e2e/tests/features/<name>/`.

To fully remove the **counter** specifically, also delete its DAML module
directory `../daml/daml/Counter/`, then rebuild the DAR and regenerate codegen
(the frontend's generated types go away with the deleted feature folder).

Delete every feature and you are left with a clean connect-shell starter
(`App.tsx` + `ConnectionBar`) ready for your own contracts and UI.
