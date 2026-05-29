# Agent Configuration — Canton Counter Scaffold

This file defines monorepo-wide rules for agents working in this repository. Each subproject can layer its own `CLAUDE.md` for stack-specific details:

- [`carpincho-wallet/CLAUDE.md`](carpincho-wallet/CLAUDE.md) — CIP-0103 wallet (Vite + React + Biome)
- [`canton-connect-kit/README.md`](canton-connect-kit/README.md) — wagmi-style React hooks for Canton dApps
- `canton-barebones/`, `counter/daml/`, `counter/frontend/` — see each subproject's `README.md`

For the system shape (data flow, components, ports), see [`architecture.md`](architecture.md).

---

## Stack & Conventions (monorepo)

| Category | Technology | Notes |
|----------|-----------|-------|
| Languages | TypeScript, DAML, Bash | TypeScript across the JS subprojects; DAML in `counter/daml/`; Bash for canton-barebones scripts |
| Package manager | npm | One `package-lock.json` per Node subproject; root `package.json` orchestrates via `npm --prefix <dir>` |
| Node | 24 | Pinned via root `.nvmrc`; inherits to every Node subproject |
| Container runtime | Docker | Used by `canton-barebones/` for the local participant + Postgres |
| Commit linting | commitlint + husky | Enforced via root `.husky/commit-msg` |
| Lint / format | Biome | One root `biome.json` and a single root `@biomejs/biome`; per-project specifics live in `overrides`. No per-subproject Biome install or config |
| Pre-commit | lint-staged | Root `.lintstagedrc.mjs` runs root Biome (`biome check --write`) across `carpincho-wallet/`, `canton-connect-kit/`, and `counter/frontend/` |
| Pre-push | tsc | Root `.husky/pre-push` runs `tsc --noEmit` per Node subproject |

## Subprojects

| Path | Purpose | Stack | Port |
|------|---------|-------|------|
| [`canton-barebones/`](canton-barebones/) | Local Canton participant + Postgres via docker-compose; deploy + health + token scripts | Docker, Bash, Node scripts | 3013/3014/3015/3016/3017/3018 |
| [`counter/daml/`](counter/daml/) | `quickstart-counter` DAML model | DAML | n/a (DAR artifact) |
| [`canton-barebones/wallet-service/`](canton-barebones/wallet-service/) | JSON-RPC bridge between the wallet and the Canton participant. Started by `npm run canton:up`. Self-mints its Canton JWT. | Node + Express + TypeScript | 3010 |
| [`carpincho-wallet/`](carpincho-wallet/) | CIP-0103 wallet — vault, signing, WalletConnect, Chrome extension | Vite 6 + React 18 + Tailwind v4 + Biome | 3011 |
| [`counter/frontend/`](counter/frontend/) | Counter dApp UI | Vite + React + Biome | 3012 |
| [`canton-connect-kit/`](canton-connect-kit/) | wagmi-style React hooks for connecting Canton dApps to CIP-0103 wallets | TypeScript + React 18 + Biome | n/a (library) |

## Code Style

- All source code in English regardless of conversation language.
- TypeScript preferred over JavaScript across Node subprojects.
- **No semicolons** in TypeScript / JavaScript across the repo.
- Lint and formatting are centralized in the root `biome.json`. Add project-specific rules under `overrides` keyed by path; do not create per-subproject Biome configs.

## Working Rules

- Use **npm** only (never pnpm or yarn).
- Install / run inside a subproject either by `cd <subproject>` or by using `npm --prefix <subproject> run <script>`. The root `package.json` exposes orchestration shortcuts:
  - `npm run canton:up` / `canton:down` / `canton:health` / `canton:token`
  - `npm run build-dar -- <daml-project>` / `npm run deploy-dar -- <dar>`
  - `npm run carpincho:build:extension`
  - `npm run app:dev`
- Local ports are intentionally assigned in the `3010+` range (see table above). Do not change them without updating every subproject's defaults.
- Treat `package-lock.json` files as authoritative. Do not delete or regenerate them as part of unrelated changes.
- Do not commit `.env.local`, `node_modules`, `dist/`, `dist-extension/`, or `.claude/settings.local.json` (covered by root `.gitignore`).

## Architecture

See [`architecture.md`](architecture.md) for the system shape, subproject layout, data flow between components, and the port allocation table.

## Testing

- Each subproject owns its own test runner. Run from the subproject directory or via `npm --prefix`:
  - `carpincho-wallet`: `npm test` (Node `node:test` + `tsx` + happy-dom)
  - `counter/frontend`: `npm test` (Node `node:test` with `--experimental-strip-types`)
  - `canton-barebones`: `npm test` (Node `node:test` against the scripts)
- Cover the paths that matter — business logic, API integrations, component behaviour. Skip styling, third-party library internals, trivial getters/setters.

## Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/).

**Format:** `type(scope): subject`

- **Scope** is optional: `feat: add login` and `feat(auth): add login` are both valid.
- **Subject** uses imperative mood, lowercase after the colon, no trailing period.
- **Body** (optional) is separated by a blank line and explains *what* and *why*.

**Allowed prefixes** (enforced by [`commitlint.config.js`](commitlint.config.js)):

| Prefix | Purpose |
|--------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance, dependencies, config |
| `docs` | Documentation only |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or updating tests |
| `style` | Formatting, whitespace, semicolons |
| `ci` | CI/CD pipeline changes |
| `perf` | Performance improvement |
| `build` | Build system or external dependencies |
| `revert` | Reverts a previous commit |
| `wip` | Work in progress (avoid on main) |
| `release` | Release-related changes |
| `hotfix` | Emergency fix bypassing normal flow |

## PR Workflow

- Every PR must reference an issue (`Closes #N`).

  > No related issue? Use `No related issue.` as the first line of the Summary section.

- Mirror the issue's acceptance criteria in the PR.
- Self-review your diff before requesting peer review.
- Keep PRs small and focused — one issue, one PR.
- PR titles use the same Conventional Commit format (`feat: add user dashboard`).
- The `create-pr` skill at `.claude/skills/create-pr/` reads [`.github/PULL_REQUEST_TEMPLATE.md`](.github/PULL_REQUEST_TEMPLATE.md) and fills every section automatically.

## Label Conventions

GitHub form dropdowns (like the Priority field in issue templates) only work through the web UI. When issues are created via `gh` CLI or REST API, dropdown values become unstructured body text — not queryable, not consistent. **Labels are the API-reliable mechanism for structured metadata.**

**Priority** (bugs, features, and epics):

| Label | Description |
|-------|-------------|
| `priority: critical` | Blocking work, system down, or security issue |
| `priority: high` | Must be addressed in current sprint |
| `priority: medium` | Should be addressed soon |
| `priority: low` | Nice to have, can wait |

Labels are queryable: `gh issue list --label "priority: high"`.

The `issue` skill at `.claude/skills/issue/` applies these labels automatically when creating issues via CLI.

## Guardrails

- Do not commit secrets, API keys, or credentials. `.env.local` files are gitignored — keep it that way.
- Do not modify CI/CD pipelines without team review.
- Do not skip tests or linting to make a build pass.
- Do not bypass the husky hooks (`--no-verify`) unless the user explicitly asks.
- When in doubt, ask — don't assume.

## Change Strategy

- Prefer small, focused diffs over broad refactors.
- Preserve existing UX unless the task explicitly changes it.
- Avoid introducing new patterns when a project pattern already exists.
- Update docs only when behaviour or workflow changes.

## Validation Checklist

Before declaring monorepo-touching work done:

- Subproject-level: `npm run lint` and `npm test` inside any subproject you touched.
- Root-level: `git push --dry-run` exercises the pre-push tsc sweep across all Node subprojects.
- For the full end-to-end loop (Canton up → DAR built → DAR deployed → wallet-service → wallet → counter app), follow [`README.md`](README.md) §1–6.

## References

- [BootNode SDLC framework](https://github.com/BootNodeDev/bootnode-sdlc)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 Canton wallet provider spec](https://github.com/digital-asset/canton/tree/main/community/app/src/pack/examples/04-canton-wallet)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
