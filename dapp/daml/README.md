# Tally Daml

The Daml package for the dApp's demo feature. `Tally` is an issuer-owned integer
counter: the issuer can increment it and grant other parties write or view
access. `TallyWriter` lets a granted party trigger an increment without being a
signatory on the counter. It backs the loyalty stamp-card demo in
[`dapp/frontend`](../frontend/README.md).

This folder owns the app Daml code. The Canton barebones does not keep app DARs
checked in.

## Build

```bash
dpm build
```

The compiled DAR is written to:

```text
.daml/dist/quickstart-tally-0.0.1.dar
```

## Deploy

For local deployment, see the Canton barebones
[Deploy a DAR](../../canton-barebones/README.md#deploy-a-dar) step.
