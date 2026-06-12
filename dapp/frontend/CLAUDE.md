# Agent Configuration

<!-- This is your project's agent configuration. Claude Code reads this file
     as CLAUDE.md. Other agents (Cursor, Windsurf, etc.) read AGENTS.md, which
     points here. Customize each section for your stack. -->

---

## Stack & Conventions

This is a LIVE direct/explicit-disclosure frontend for the `cc-vesting-contracts` (DAML/Canton)
vesting app. It is no longer mocked: it talks to a real ledger through the wallet-service
`ledgerApi` proxy (the JSON-RPC `ledgerApi` method, default `http://localhost:3010/rpc`), reading
the ACS and submitting commands directly. It lives in the repo's root **npm workspaces**.

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | TypeScript (strict mode) | |
| Framework | Vite 6 + React 19 | Function components only |
| Routing | React Router 7 | `createBrowserRouter` (`src/routes.tsx`) |
| State | Zustand 5 | `useVestingStore` (domain), `useUiStore` (UI) |
| Styling | Tailwind CSS v4 | CSS-first `@theme inline`; no `tailwind.config` |
| Package manager | npm (root workspaces) | Node `>=24` (`.nvmrc`) |
| Linting | Biome 2 | Run `npm run lint` before committing |
| Testing | Vitest 3 | Unit tests for vesting math (`lib/schedule.test.ts`) |
| Naming | camelCase vars/functions, PascalCase components/types | Component files PascalCase, others camelCase |

## Code Style

Enforced by Biome (`biome.json`) — do not hand-fight the formatter:

- **Semicolons:** no (`asNeeded`)
- **Quotes:** single
- **Print width:** 100
- **Trailing commas:** all
- **Indent:** spaces, width 2
- **Import ordering:** Biome `organizeImports` (on) — let it sort
- **Imports:** use the `@/` alias; never include the file extension in imports (Biome errors)

## Working Rules

- Use **npm** only (the repo uses root npm workspaces; never pnpm or yarn)
- Path alias: `@/*` maps to `src/` (tsconfig `paths` + Vite `resolve.alias`)
- Tailwind v4 is CSS-first: tokens live in `src/theme/tokens.css` (dual-mode) and are mapped to
  utilities in `src/styles/index.css` via `@theme inline`. There is **no** `tailwind.config`.
- The ledger is live behind a swappable backend boundary (`src/backend/`): commands and ACS reads
  go through the wallet-service `ledgerApi` proxy. Keep the public shapes aligned with the DAML
  templates and the `ledgerApi` request/response surface.
- Components read figures from `deriveGrant()` / `lib/schedule.ts` — never recompute vesting inline.

## Architecture

<!-- See architecture.md for the full system overview: project structure,
     key abstractions, data flow, and domain-specific details. Keep this
     section as a quick pointer -- not a duplicate. -->

See [`architecture.md`](architecture.md) for project structure, data flow, and key abstractions.

## Testing

<!-- Define what to test, how to test it, and what not to bother with -->

- **Framework:** Vitest (React Testing Library not set up yet — add it if testing components)
- **Run tests:** `npm test`
- **What to test:** Vesting math (`lib/schedule.ts`) and store actions/selectors — the logic
  that must stay faithful to the contracts. Component behavior once RTL is added.
- **What not to test:** Styling, third-party library internals, trivial getters/setters
- **Coverage:** Aim for meaningful coverage, not a number. Cover the paths that matter.

## Commit Standards

Use [Conventional Commits](https://www.conventionalcommits.org/):

**Format:** `type(scope): subject`

- **Scope** is optional: `feat: add login` and `feat(auth): add login` are both valid
- **Subject** uses imperative mood, lowercase after the colon, no trailing period
- **Body** (optional): separated by a blank line, explains *what* and *why*

**Prefixes:**

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

## PR Workflow

- Every PR must reference an issue (`Closes #`)

  > No related issue? Use `No related issue.` as the first line of the Summary section.

- Mirror the issue's acceptance criteria in the PR
- Self-review your diff before requesting peer review
- Keep PRs small and focused -- one issue, one PR
- PR titles use the same conventional commit format (`feat: add user dashboard`)
- Use `/sdlc:create-pr` to create PRs -- it reads the template and fills every section automatically

## Label Conventions

GitHub form dropdowns (like the Priority field in issue templates) only work through the web UI. When issues are created via `gh` CLI or REST API, dropdown values become unstructured body text -- not queryable, not consistent. **Labels are the API-reliable mechanism for structured metadata.**

**Priority** (bugs, features, and epics):

| Label | Description |
|-------|-------------|
| `priority: critical` | Blocking work, system down, or security issue |
| `priority: high` | Must be addressed in current sprint |
| `priority: medium` | Should be addressed soon |
| `priority: low` | Nice to have, can wait |

Labels are queryable: `gh issue list --label "priority: high"`.

The `/sdlc:issue` skill applies these labels automatically when creating issues via CLI. Bug, feature, and epic templates include a Priority dropdown for web UI users, but labels are the source of truth for programmatic workflows.

## Guardrails

- Do not commit secrets, API keys, or credentials
- Do not modify CI/CD pipelines without team review
- Do not skip tests or linting to make a build pass
- When in doubt, ask -- don't assume

## Change Strategy

- Prefer small, focused diffs over broad refactors
- Preserve existing UX unless the task explicitly changes it
- Avoid introducing new patterns when a project pattern already exists
- Update docs only when behavior or workflow changes

## Validation Checklist

<!-- Commands the agent (and developers) should run before declaring work done. -->

- `npm run lint`
- `npm test`
- `npm run build` (when feasible for runtime-impacting changes)

## References

<!-- Links to external documentation the agent should consult when working
     on this project. Keeps the agent grounded in current APIs rather than
     stale training data. -->

- [cc-vesting-contracts](https://github.com/BootNodeDev/cc-vesting-contracts) — the DAML/Canton contracts this UI targets (templates, choices, schedule math)
- [canton-connect-kit](https://github.com/BootNodeDev/bn-canton-dev-stack) — wallet hook API that `src/wallet/` mirrors; `src/wallet/` is now a live wallet-service client (`StealthWallet`), not a mock
- [dappbooster-canton-landing](https://github.com/BootNodeDev/dappbooster-canton-landing) — source of the palette and typography tokens
- Live deploy: https://cc-vesting-contracts-ui.vercel.app
