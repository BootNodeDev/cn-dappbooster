# Vendored API specs

This directory contains the canonical Canton wallet OpenRPC specifications,
vendored from https://github.com/canton-network/wallet/tree/main/api-specs.

## Files

- `openrpc-dapp-api.json` — the in-process dApp ↔ wallet API (CIP-0103).

## Why vendored?

`canton-barebones/wallet-gateway-devkit` aligns its wire format with this spec but does not
depend on the upstream codegen toolchain. The TS types in `src/types.ts` are
hand-authored against the schemas in this file.

## Refresh

Replace the file from upstream with:

```bash
gh api repos/canton-network/wallet/contents/api-specs/openrpc-dapp-api.json --jq '.content' \
  | base64 -d > canton-barebones/wallet-gateway-devkit/api-specs/openrpc-dapp-api.json
```

When refreshing, also re-verify `src/types.ts` matches the schema fields used.
