# Expenzo

Turborepo monorepo sharing components between a Next.js web app and a React Native (Expo) mobile app.

## Layout

```
apps/
  web/                 Next.js 16, App Router, Tailwind CSS
  mobile/              Expo SDK 54 / React Native 0.81, NativeWind
packages/
  ui/                  Shared components and helpers
  tailwind-config/     Design tokens shared by both apps
  typescript-config/   Base tsconfig presets
  eslint-config/       Shared flat ESLint configs
```

## How sharing works

`packages/ui` splits each component in two: a `.tsx` file rendering DOM elements
and a `.native.tsx` file rendering React Native primitives. Metro picks the
`.native` variant automatically; Next.js picks the plain one. Both import their
class names from a shared `*.styles.ts` module, so the styling, prop types and
logic live in one place while the primitives stay platform-appropriate.

Design tokens (colors, radii, spacing) live in `packages/tailwind-config/theme.js`
and are consumed by both `tailwind.config.js` files.

## Commands

Run from the repo root:

```bash
pnpm install
pnpm dev          # web on :3000 and the Expo dev server
pnpm build        # production build of the web app
pnpm lint         # ESLint across every workspace
pnpm check-types  # tsc --noEmit across every workspace
pnpm test         # unit tests across every workspace
pnpm test:e2e     # Playwright against a production build of the web app
pnpm format       # Prettier write
```

Mobile only:

```bash
pnpm --filter @expenzo/mobile dev
```

The mobile app uses **expo-router**, so its routes are files under
`apps/mobile/src/app` and mirror the web app's App Router tree. There is no
`App.tsx` or `index.js`: `"main": "expo-router/entry"` mounts the route tree.

Keep route files thin — they compose components and call hooks, nothing more —
and test the components they render instead. Deep links come for free from the
`expenzo://` scheme, which is what wallet capture will use in M6.

Install native packages with `expo install`, never `pnpm add`: it pins to what
the SDK expects, which is often _older_ than npm's latest.

```bash
pnpm --filter @expenzo/mobile exec expo install <package>
```

## Design

Tokens live in `packages/tailwind-config/theme.js` and are consumed by both
apps. The palette is a teal ramp whose darkest and brightest stops double as the
two ends of the balance panel's gradient, plus a mint accent for calls to
action, on a light grey background with white cards.

Two rules the code enforces rather than documents:

- The accent is bright enough that a **dark** label is the only one that passes
  contrast on it, so `buttonLabelClass('primary')` returns `text-content`.
- `fieldInputClass()` is the single definition of an input. Forms must not
  carry their own copy — that is how the shared pickers came to lay their labels
  out inline while the forms around them stacked.

A gradient cannot be a class name on native, so it is not a token.
`GradientSurface` renders it per platform from one shared pair of stops.

## Local database

The backend is Supabase, run locally in Docker. Docker must be running first.

```bash
pnpm db:start    # boot the stack (first run pulls images)
pnpm db:status   # URLs and keys for your .env files
pnpm db:up       # apply the migrations this database has not seen yet
pnpm db:seed     # load supabase/seed.sql; safe to re-run
pnpm db:lint     # schema linter
pnpm db:test     # pgTAP tests, including row-level security
pnpm db:stop
```

`pnpm db:up` is how the local database moves forward. There is also a
`pnpm db:reset`, which replays every migration from zero and re-seeds — it
**destroys the accounts and ledger you have built up in dev**, so reach for it
only when you actually want an empty database. Nothing in the verification path
needs it: `db:up` applies what is pending, and pgTAP runs inside a transaction
it rolls back. CI is what proves the migrations replay cleanly from empty.

Ports are **54421–54424**, not Supabase's usual 54321–54324, so this stack can
run alongside another local Supabase project. Studio is on
<http://127.0.0.1:54423> and the local mail catcher on <http://127.0.0.1:54424>.

Copy `apps/web/.env.example` to `apps/web/.env.local` and
`apps/mobile/.env.example` to `apps/mobile/.env`, then fill them from
`pnpm db:status`.

Reference data that production needs — system categories, the service catalogue
— belongs in a **migration**, not `seed.sql`, which only runs locally.

## Testing

| Workspace       | Runner                      | Covers                                                        |
| --------------- | --------------------------- | ------------------------------------------------------------- |
| `packages/ui`   | Vitest (jsdom)              | shared logic and the web `.tsx` component variants            |
| `packages/i18n` | Vitest (node)               | catalogue parity, plural forms and the i18next factory        |
| `apps/web`      | Vitest (jsdom) + Playwright | app components and browser end-to-end flows                   |
| `apps/mobile`   | jest-expo                   | mobile code and the `.native.tsx` variants, via `@expenzo/ui` |

Both component suites render in **English**, while the app itself defaults to
**Ukrainian** — see `vitest.setup.ts` and `jest.setup.js`. Pinning them keeps
the assertions readable in one language rather than needing a rewrite per
language added; the Ukrainian default is covered where it is the subject, in
`apps/web/e2e/locale.spec.ts` and the `packages/i18n` catalogue tests.

The two runners resolve the platform split for free. Vite's default extension
list omits `.native.tsx`, so Vitest always gets the web half; `jest-expo/ios`
orders `native.tsx` ahead of `tsx`, so jest always gets the native half. Native
components are therefore tested _from_ `apps/mobile`, which is the real
integration path.

Playwright needs its browser once per machine:

```bash
pnpm --filter @expenzo/web exec playwright install chromium
```

It runs against `next start` on port 3100 — deliberately not 3000, so a running
`pnpm dev` is never hijacked.

## Deployment

The trunk is **`development`**. Feature branches are cut from it and merge back
into it, and what lands there goes live.

Two things happen on a merge, and only one of them is in this repository.

**The web app** is built by Vercel's own Git integration, which watches
`development` as the production branch. Nothing here holds a Vercel token, and
every pull request gets a preview deployment for free.

**The database** is moved forward by `.github/workflows/deploy.yml`. It is
triggered by CI _finishing successfully_ rather than by the push, because
applying migrations from a branch whose tests are red is the one failure this
pipeline must not have. It runs `supabase db push` against the linked project
and then posts to `/api/fx/sync` so production has real exchange rates.

`supabase/seed.sql` is deliberately **not** part of that. It is local-only
fixtures — plausible rates so foreign-currency expenses can be entered offline
— and `expenses_set_base_amount` freezes whatever rate it finds into every row
at write time, so seeding invented rates into production would bake wrong
figures into real ledgers permanently. Anything production genuinely needs goes
in a migration.

One ordering caveat: Vercel starts building on the push while the migration job
waits for CI, so a new build can be live for a minute or two before the schema
it expects. Migrations here are additive, which makes that window survivable.
If a change ever needs the schema first, turn off automatic deployment for the
project in Vercel and trigger a deploy hook from a job that `needs` the
migration one.

Repository secrets the migration workflow needs, under the `production`
environment:

| Name                    | What it is                                        |
| ----------------------- | ------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | a CLI access token from the Supabase account page |
| `SUPABASE_DB_PASSWORD`  | the linked project's Postgres password            |
| `FX_SYNC_SECRET`        | must match `FX_SYNC_SECRET` in the Vercel project |

Plus one repository **variable**, `PRODUCTION_URL` — the origin the app is
served from, used to reach the sync route. The project ref itself is not a
secret and is written into the workflow: it is the host in
`NEXT_PUBLIC_SUPABASE_URL`, which ships in the client bundle.

## Notes

- pnpm uses `nodeLinker: hoisted` (see `pnpm-workspace.yaml`) because Metro does
  not follow pnpm's symlinked store reliably.
- Native dependency versions are pinned to what Expo SDK 54 expects; verify with
  `pnpm --filter @expenzo/mobile exec expo install --check`.
- The shared ESLint config avoids type-aware rules, since `eslint-config-next`
  substitutes its own parser that does not forward `parserOptions.project`.
- Never add `@types/jest`. The hoisted linker puts every `@types/*` package in
  the root `node_modules/@types`, where TypeScript picks it up for every
  program — jest's global `expect` would then collide with Vitest's. Mobile
  tests import from `@jest/globals` instead.
