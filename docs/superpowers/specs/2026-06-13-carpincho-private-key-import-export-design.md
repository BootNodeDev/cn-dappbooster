# Carpincho Private Key Import/Export Design

## Scope

Add two Settings menu entries in `carpincho-wallet`:

- `Import private key`
- `Export private key`

Both entries live in the existing right-side drawer flow under `Settings`.

## Import Private Key

The import screen renders a form with exactly three user fields:

- `Party ID`
- `Party name`
- `Private key`

On submit, the wallet trims the fields, validates that all are present, derives the Ed25519 public key from the private key locally, and stores the account through the existing vault account path. The imported account uses the current wallet-service network id so imported accounts behave like created accounts in provider, token, and activity flows.

Invalid private keys surface as field-level/form feedback and do not mutate the vault. A successful import closes or returns from the import flow with a toast confirming the account was imported.

## Export Private Key

The export screen reads the current selected account (`vault.primary`) and shows that account's private key directly because the user explicitly requested no password re-check.

If there is no selected account, the screen shows an empty-state message. The screen includes account context (`partyName` and `partyId`) and a copy action for the private key.

## Vault API

The existing `AccountPublic` projection remains secret-free. A new explicit vault method returns the private key for a requested account id while the vault is unlocked. This keeps secret access auditable and prevents private keys from leaking into normal account lists, snapshots, provider payloads, or tests that consume public account data.

## Testing

Add focused tests for:

- Settings navigation exposes both new entries.
- Import form validates required fields and calls `addAccount` with a derived public key.
- Export view shows the selected account private key and copies it.
- Vault secret export returns only the requested unlocked account's private key and rejects unknown accounts.
