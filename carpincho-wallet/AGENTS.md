# Agent Configuration — carpincho-wallet

This file applies only to `carpincho-wallet/`. For monorepo-wide rules (commit standards, PR workflow, label conventions, guardrails, change strategy), see [`../AGENTS.md`](../AGENTS.md).

---

## Stack & Conventions

| Category | Technology | Notes |
|----------|-----------|-------|
| Language | TypeScript (strict mode) | |
| Framework | Vite 6 + React 18 | SPA; also builds as a Chrome extension |
| Styling | Tailwind CSS v4 | `@tailwindcss/vite` plugin; utility classes inline in JSX; `src/index.css` declares semantic CSS variables on `:root` / `[data-theme='dark']`, rebinds the `dark:` variant via `@custom-variant`, exposes tokens to Tailwind through `@theme inline`, and holds `@layer base` resets plus named keyframes (`fade-in`, `slide-down-and-fade`, `slide-up-and-fade`, `sheet-up`, `sheet-slide-right`, `slide-in-right`, `slide-in-left`, `soft-pulse`, `drift`). A brand-tinted radial top-glow (`--bg-radial`) sits behind the page; there is no paper-grain overlay |
| Theming | Light / Dark / System selector in the drawer menu (dappbooster brand palette) | `src/theme/ThemeProvider.tsx` owns a persisted `mode` (`light` \| `dark` \| `system`, default `system`), exposes `{ mode, setMode }` via `useTheme()`, resolves `system` against `prefers-color-scheme` (and re-resolves on media changes while in `system`), and writes the resolved `data-theme` on `<html>` after mount. The selector lives in the drawer at Settings → Theme (`src/components/menu/ThemeMenu.tsx`); there is no header toggle. Use semantic colour utilities (`bg-surface`, `text-foreground`, `border-border`, `bg-primary-soft`, `bg-scrim`, etc.) so styles flip automatically. The dark theme is cool navy (`#14152b`) matching `dappbooster-canton-landing`; the light theme is neutral grey (`#f7f7f7`, primary `#692581`) matching the `dAppBooster` boilerplate. A shared purple→pink brand accent — `--bg-gradient-brand` (`linear-gradient(135deg, #c670e5, #e71d73)`) plus `--shadow-glow` — reveals on primary-button hover and tints the hero wordmark. `--color-success` is green (used for the connected-state indicator); `--color-scrim` is the theme-aware overlay tint used by modal/sheet backdrops |
| Fonts | Self-hosted via `@fontsource-variable/manrope`, `@fontsource-variable/jetbrains-mono` | Imported once in `src/main.tsx`; works offline in the extension popup. Manrope is the entire UI: `font-display` for hero wordmarks, view-level headings, section markers (heavier weight for hierarchy) and `font-sans` for UI chrome / body / labels / buttons. `font-mono` (JetBrains Mono) is for party IDs, hashes, RPC URLs, JSON payloads, status eyebrows |
| UI primitives | Radix UI | `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, `@radix-ui/react-toast`, `@radix-ui/react-tooltip` for modals (incl. bottom sheets), tabs, toasts, and tooltips (auto-positioning with collision detection; `TooltipProvider` mounted once in `App.tsx`); styled with Tailwind via `data-[state=...]` and `data-[highlighted]` variants and animated through the `animate-*` tokens above. **When adding a new interactive component, check the [Radix UI primitives catalogue](https://www.radix-ui.com/primitives) first — prefer a Radix primitive over a hand-rolled implementation.** Local primitives in `src/components/ui/` (Button family, TextInput, PasswordInput, Alert (info / error / warning / success variants), Card, AccountAvatar, PendingActionCard, Sheet, Tabs, OptionList, Stepper, DangerConfirm, MenuRow, ToastProvider, Tooltip) compose Tailwind utilities + Radix where applicable; reuse them before writing one-off styling. `TextInput` and `PasswordInput` accept an `error?: boolean` prop that applies a danger border + persistent focus ring (`--shadow-focus-danger`) and sets `aria-invalid`; use this for field-level error state instead of wrapping in an `Alert`. Icon SVG literals live in [`src/components/ui/icons.tsx`](src/components/ui/icons.tsx) (`X_ICON`, `BACK_ICON`, `MENU_ICON`, `CHECK_ICON`, `COPY_ICON`, `EYE_ICON`, `EYE_OFF_ICON`, `SPINNER_ICON`); add new icons there instead of inlining `<svg>`. Custom width/height tokens (`w-popup`, `w-drawer`, `max-h-sheet`) are declared as `@utility` in `src/index.css`. `Sheet` wraps Radix Dialog with the shared overlay, title, and close-button chrome and takes `side: 'bottom' | 'right'` (default `'bottom'`); the bottom variant uses `animate-sheet-up`, the right variant uses `animate-sheet-slide-right`, caps at 400px wide (clamped by `100vw`), full-height, top-aligned content -- always use `Sheet` for sheet-style flows. `Button.tsx` also exports `GHOST_BUTTON_CLASS` and `ICON_BUTTON_CLASS` for places that need the interactive base without the button element. Larger shared building blocks live one level up in `src/components/` (`WelcomeHero` for the Setup/Unlock hero; `AccountCard`, `HomeTabs`, `ConnectionFooter` compose the Home view. The Home view is a fixed-height (`h-screen`) flex shell: the account selector and footer (no longer `fixed` — it lives in the column flow, bled full-width with `-mx-3`) stay pinned while only the active tab body scrolls. `HomeTabs` (the `Tabs` underline bar acts as the view title — no heading) holds `ActivityList` (executed transactions as MetaMask-style rows grouped by day, each opening a centered detail `Sheet`) and `AssetsPanel` (a mocked empty placeholder). WalletConnect URI pairing lives in the drawer via `WalletConnectMenu`, the first root menu screen, web-only; `PasswordStrengthIndicator` renders the live strength meter; `NewPasswordFields` owns the "new password + confirm + strength meter + validity callback" trio used by both the Setup form and the change-password form -- callers control the visible-vs-aria label mode and receive validity via `onValidityChange`). AddAccount and ConnectionSettings render as bottom `Sheet` instances from `HomeView`, not as full-view replacements. `MenuSheet` (the burger-button drawer, right-anchored, 400px wide capped at `100vw`) drives multi-screen flows by toggling an internal `Screen` state inside one `Sheet`; every new sub-section in the drawer must be added as another `Screen` entry (drill-down with title + back + close + `animate-slide-in-*` transitions) — no accordion-style expansion |
| Feedback | Toast vs inline Alert vs error prop | Transient system feedback (action results, async errors, network failures, copy confirmations) renders via `toast.*` from [`@/components/ui/toast.ts`](src/components/ui/toast.ts) — never as inline `Alert`. Mount the `ToastProvider` once in `App.tsx`. Field-level error state (mismatched passwords, wrong current password on a verify step, invalid input) uses the `error` prop on `TextInput` / `PasswordInput` (danger border + `aria-invalid`); pair it with `aria-errormessage` pointing at a sibling caption `<p>` when there is a human-readable reason to render. Inline `Alert` is reserved for form-level errors that cannot be attributed to a single field and for persistent contextual hints inside cards. All callers (React components, WalletConnect handlers in `src/wc/`, vault errors, extension bridge) use the imperative `toast` import directly. Variant durations: non-critical variants (`info` / `success` / `warning`) auto-dismiss after 3 s; only `error` (must-read) persists until dismissed. Identical messages collapse — emitting a string message that matches a visible toast of the same variant replaces it with a fresh entry (so rapid repeats like copy clicks collapse to a single toast and restart its timer); distinct messages of the same variant (a copy confirmation vs an RPC test result) stack separately. Toasts render as elevated `bg-surface` cards (border + `shadow-popover`) with a variant-tinted icon badge and a left accent rail, sized to the app content width (`w-popup`). Max 3 visible, top-center, newest on top |
| Package manager | npm | lockfile: `package-lock.json` |
| Linting | Biome (root config) | Single root `biome.json` + root `@biomejs/biome`; this project's rules (`@/` alias enforcement, Tailwind CSS parsing) live in a path `override`. Enforced via the root pre-commit hook; run `npm run lint` manually |
| Node | 24 | inherited from `../.nvmrc` |
| Naming | camelCase vars/functions, PascalCase components/types, kebab-case files | |

## Code Style

- **Semicolons:** no
- **Quotes:** single
- **Indent:** 2 spaces
- **Imports:** every import that resolves inside `src/` must use the `@/*` alias (e.g. `import { Foo } from '@/components/Foo'`); relative `./` and `../` paths are banned by Biome's `style/noRestrictedImports`. Do **not** add the `.ts` / `.tsx` extension on import paths — `moduleResolution: bundler` (Vite + the tsx test loader) resolves extensionless. Because resolution is extensionless, two modules in the same directory must not differ only by case and extension (e.g. `Toast.tsx` vs `toast.ts`), or the import becomes ambiguous on a case-insensitive filesystem. The alias is declared in `tsconfig.app.json`, `test/tsconfig.json`, and `vite.config.ts`
- **Functional style:** prefer `const` with expression-returning forms (ternaries, IIFEs, helper functions, lookup objects, destructured ternaries) over `let` + reassignment. Reach for `let` only when no clean expression form exists.

## Working Rules

- Use **npm** only (never pnpm or yarn)
- Use the `@/*` alias for every import that resolves inside `src/`. Relative `./` / `../` paths are linter errors
- Build outputs: `dist/` for the web build and `dist-extension/` for the Chrome extension (`npm run build:extension` locally, or `npm run carpincho:build:extension` from the repo root)
- Dev server: `http://localhost:3011`

## Architecture

See [`architecture.md`](architecture.md) for project structure, data flow, and key abstractions inside the wallet. For how the wallet plugs into the rest of the monorepo (dApp, wallet-service, canton-barebones), see [`../architecture.md`](../architecture.md).

## Testing

- **Framework:** Node built-in `node:test` with `tsx` as the loader (transforms TS + TSX, automatic React JSX runtime)
- **DOM environment:** `@happy-dom/global-registrator` bootstrapped in [`test/setup-dom.ts`](test/setup-dom.ts) for React Testing Library interaction tests
- **Test config:** [`test/tsconfig.json`](test/tsconfig.json) sets `jsx: react-jsx`; `TSX_TSCONFIG_PATH` in the test script points tsx at it
- **Run tests:** `npm test`
- **What to test:** Business logic, API integrations, component behavior
- **What not to test:** Styling, third-party library internals, trivial getters/setters
- **Coverage:** Aim for meaningful coverage, not a number. Cover the paths that matter.

## Validation Checklist

- `npm run lint`
- `npm test`
- `npm run build` (when feasible for runtime-impacting changes)

## References

- [WalletConnect Sign Client](https://docs.walletconnect.com/api/sign/overview)
- [CIP-0103 Canton wallet provider spec](https://github.com/digital-asset/canton/tree/main/community/app/src/pack/examples/04-canton-wallet)
- [Reown (WalletConnect cloud)](https://cloud.reown.com)
