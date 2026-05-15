# Carpincho Wallet vs Wallet Gateway Proposal

Comparison against canton-foundation/canton-dev-fund PR 109:
https://github.com/canton-foundation/canton-dev-fund/pull/109

## Summary

PR 109 is a grant proposal for a full Wallet Gateway Reference Implementation. It describes a vendor-neutral, enterprise-grade middleware layer that sits between dApps, validator nodes, and signing providers.

Carpincho Wallet is currently a lightweight local browser extension wallet for development. It already validates one important part of that proposal: connecting a browser dApp to a local wallet through `postMessage`, without WalletConnect.

The projects are aligned directionally, but they are at very different scope levels.

## Comparison

| Area | Wallet Gateway Proposal | Carpincho Wallet |
| --- | --- | --- |
| Primary goal | Enterprise-grade, vendor-neutral wallet gateway | Local developer wallet extension |
| Current state | Proposal, no implementation in that PR | Working code on `walletV2` |
| dApp connection | CIP-0103 dApp API | `postMessage` through browser extension |
| WalletConnect | Not the main path | Retained as fallback in the dApp |
| Browser extension support | Milestone 3: local browser engine | Already implemented as a simple extension bridge |
| Remote gateway | NodeJS Docker service colocated with validator | Not implemented |
| API boundaries | User API, dApp API, Signing Provider API, Ledger API | Internal provider dispatcher plus wallet-service calls |
| Security model | Scoped access, OIDC, read/write approvals | Basic local approval flow, no origin scopes yet |
| Clear signing | Explicit transaction visualization and cryptographic guarantees | Basic approval UI, not clear-signing complete |
| Signing providers | Institutional drivers, passkeys, paper keys, external key stores | Local/dev vault model |
| Multi-session | Required milestone | Not designed yet |
| Audit/compliance | Internal and external audit milestones | Not in scope yet |

## Where Carpincho Already Matches The Proposal

Carpincho already covers the smallest useful version of the "Local Browser Engine / Extension Wallet Gateway" described in Milestone 3.

Current flow:

1. The dApp detects the extension via `SPLICE_WALLET_EXT_READY` / `SPLICE_WALLET_EXT_ACK`.
2. The dApp sends CIP-0103-style JSON-RPC requests with `SPLICE_WALLET_REQUEST`.
3. The content script forwards those requests to the extension background worker.
4. The wallet UI receives pending approvals.
5. The provider dispatcher handles supported wallet methods.
6. The response is posted back to the dApp with `SPLICE_WALLET_RESPONSE`.

Relevant local files:

| File | Responsibility |
| --- | --- |
| `src/extension/contentScript.ts` | Announces the provider and bridges page `postMessage` traffic to extension runtime messages |
| `src/extension/background.ts` | Stores pending dApp requests and opens/focuses the wallet UI |
| `src/provider/dispatch.ts` | Normalizes CIP-0103 methods and routes provider requests |
| `../counter/frontend/src/extensionProvider.ts` | Creates the dApp-side `ExtensionAdapter` for `carpincho-wallet` |
| `../counter/frontend/src/wallet.ts` | Prefers the browser extension and falls back to WalletConnect |

## Gaps Against The Proposal

Carpincho is useful for local development, but it is not yet a Wallet Gateway implementation.

Missing pieces:

1. No formal dApp permission model by origin.
2. No read/write scope authorization.
3. No self-signed OIDC token issuance.
4. No User API vs dApp API separation.
5. No generic Signing Provider API.
6. No institutional signing drivers.
7. No passkey, hardware wallet, paper key, or external key driver abstraction.
8. No cryptographic clear-signing guarantee.
9. No transaction visualizer schema.
10. No multi-session isolation.
11. No remote Docker gateway mode.
12. No audit-ready security boundary documentation.

## Recommended Refactor Path

The right next step is not to copy the full enterprise gateway design. The practical path is to extract the parts we already have into a reusable local gateway core, then add capabilities incrementally.

### Phase 1: Extract Local Gateway Core

Create a small reusable package or module around:

- provider request normalization
- account mapping
- status building
- `connect`, `status`, `listAccounts`, `getPrimaryAccount`, `ledgerApi`
- pending approval request lifecycle
- JSON-RPC request/response helpers

Goal: make the extension a host for gateway logic instead of the gateway logic being embedded directly in UI/runtime files.

### Phase 2: Add dApp Permissions

Track permissions per `origin`.

Minimum useful model:

- origin
- allowed networks
- allowed parties
- allowed methods
- created/updated timestamps
- user approval state

This would let the extension remember that a given dApp can read a party or request writes without re-prompting for every harmless call.

### Phase 3: Add Read And Write Review

Separate approvals into:

- connect/read approval
- transaction/write approval
- sign-message approval

The write approval should display the exact command or prepared transaction payload before execution.

### Phase 4: Define Signing Provider Boundary

Introduce a local signing provider interface, even if the first implementation is still the current vault.

This should make it possible to later plug in:

- local vault
- passkey
- external CLI signer
- hardware wallet bridge
- institutional signing service

### Phase 5: Move Toward Clear Signing

Add a structured transaction review model that can later become compatible with the proposed TX schema / visualizer work.

Short-term goal: make the approval screen deterministic and auditable.

Long-term goal: cryptographically bind what the user sees to what gets signed/submitted.

## Practical Conclusion

Carpincho should remain a lightweight developer wallet for now.

The extension work is already compatible with the direction of PR 109 because it proves the local browser extension connection model. The next useful refactor is to extract a small gateway core and add origin-scoped permissions. That gives us a clean path toward the proposal without taking on the full enterprise gateway scope immediately.
