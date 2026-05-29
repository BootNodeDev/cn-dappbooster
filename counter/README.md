# Counter

Minimal counter app split into:

- `daml`: Counter Daml package.
- `wallet-service`: Express bridge used by Carpincho to reach the participant.
- `frontend`: React dApp that knows the Counter signature and talks to Carpincho through WalletConnect.

The Canton barebones lives in `../canton-barebones`.
