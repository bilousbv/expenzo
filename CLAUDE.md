# CLAUDE.md

## Caveman mode

Use the caveman plugin for every message in this repo to reduce token usage. Activate caveman mode (full intensity) at session start and keep it on for all responses — terse output, full technical accuracy, no filler. See `/caveman` for controls (`lite|full|ultra|off`).

## Repo

Turborepo monorepo, pnpm workspaces. `apps/web` (Next.js), `apps/mobile` (Expo), `packages/ui` (shared components), plus shared tailwind/tsconfig/eslint config packages. See [README.md](README.md) for the layout and the component-sharing convention.

Verify changes with `pnpm format:check`, `pnpm lint`, `pnpm check-types`, `pnpm test` and — when web-visible behaviour changed — `pnpm test:e2e`, all from the root.

## Feature workflow

Feature work goes through the `feature-workflow` skill in [.claude/skills/feature-workflow](.claude/skills/feature-workflow/SKILL.md), invoked as `/start-feature` and `/finish-feature` or by saying "start feature" / "finish feature".

Start it automatically when beginning execution of an approved plan, before the first edit. Its rules in brief: branch per feature off the trunk, tests written before the implementation and observed failing first, and the full gate green before anything is committed. Pushes and pull requests always need explicit confirmation.

### Constraints worth remembering

- pnpm runs with `nodeLinker: hoisted`; Metro breaks under the default symlinked store.
- Mobile native dependency versions must match Expo SDK 57 exactly — check with `pnpm --filter @expenzo/mobile exec expo install --check` after touching them.
- ESLint is pinned to 9.x: `eslint-config-next` ships a parser that crashes on ESLint 10.
- The shared ESLint config uses no type-aware rules, because `eslint-config-next` swaps in a parser that does not forward `parserOptions.project`.
- Shared components are split `Foo.tsx` (web) / `Foo.native.tsx` (native) around a common `Foo.styles.ts`. Add both halves when adding a component — and a test for each: Vitest in `packages/ui` covers the web half, jest-expo in `apps/mobile` covers the native half.
- Never add `@types/jest`; under the hoisted linker it leaks jest's globals into the Vitest programs. Mobile tests import from `@jest/globals`.
- Playwright needs a one-time `pnpm --filter @expenzo/web exec playwright install chromium`.
- Mobile routes are files under `apps/mobile/src/app` (expo-router). There is no `App.tsx`; `"main": "expo-router/entry"` mounts the tree. Keep route files thin and test the components they render — `apps/mobile/__tests__/button.test.tsx` is the canary that Metro still resolves `.native.tsx`.
- Do not add `expo-router/babel` to `babel.config.js`; it was folded into `babel-preset-expo` in SDK 50 and re-adding it is a hard error.
- `typedRoutes` stays off until CI has a codegen step — it writes a gitignored file that only exists after the dev server runs, so `check-types` would fail in CI.
- Supabase runs locally in Docker on ports **54421–54424** (not the defaults), so it can coexist with another local Supabase project. Schema work is verified with `pnpm db:reset && pnpm db:lint && pnpm db:test`.
- Always go through `pnpm db:*`. The CLI is pinned to 2.115.0 as a devDependency; a globally installed `supabase` may be older and rejects config keys this repo uses.
- `additional_redirect_urls` in `supabase/config.toml` is an exact-match allow-list, and an unlisted URL does **not** error — GoTrue silently falls back to `site_url`, so the magic link lands on the site root and the code is never exchanged. The callback carries `?next=`, and an exact entry stops matching once a query is appended, so each origin needs a `/**` entry. `localhost` and `127.0.0.1` are different origins and both need listing.
- `enabled` under `[auth.external.*]` cannot be `env()`-substituted: the CLI parses the file as TOML before expanding, so a string where a boolean belongs fails with "unexpected character 'n' while scanning for a number". Turning a provider on is a config edit plus credentials in the environment.
- Password rules live in `packages/domain/src/schemas/auth.ts` and must stay in step with `minimum_password_length` in `supabase/config.toml`. bcrypt reads only the first 72 bytes, so longer passwords are refused rather than silently truncated.
- Row-level security is tested with pgTAP in `supabase/tests/`, not TypeScript — only SQL can cheaply assert "this user sees zero rows".
- Anything production needs (system categories, the service catalogue) goes in a **migration**. `supabase/seed.sql` only runs locally.
- `expenses.base_amount_minor`, `fx_rate` and `fx_rate_date` are written by the `expenses_set_base_amount` trigger, never by a client — every household total is summed from that column. The trigger recomputes only when the amount, currency, date or household changes, so an ordinary edit (a soft delete included) keeps the frozen figure rather than re-rating at whatever is in `fx_rates` today.
- The money arithmetic exists twice: `app.minor_units` / `app.convert_minor` in SQL and `minorUnitsFor` / `convertMinor` in `packages/domain`. They must agree, or the figure previewed before saving is not the figure saved. Both test suites assert the same cases.
- pgTAP tests that assert exact figures must clear `public.fx_rates` first — `seed.sql` fills it, and an insert for a date the seed already covers hits the primary key.
- A currency the rate feed does not quote is **refused** at write time rather than converted at one. ECB covers about thirty; `listSupportedCurrencies` reads the table so the picker offers only what can actually be converted.
