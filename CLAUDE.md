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
- Design tokens live in `packages/tailwind-config/theme.js` and must be expressible on both platforms. The balance panel's gradient is the one exception and is **not** a token: `GradientSurface` renders it per platform from `GRADIENT_STOPS`, because a gradient cannot be a class name on native. A native-only dependency like `expo-linear-gradient` goes in `packages/ui` **devDependencies** (tsc needs the types for the `.native.tsx` half) and in `apps/mobile` dependencies via `expo install`.
- The primary button's label is `text-content`, not `text-content-inverse`. The accent mint is bright enough that a white label fails contrast, so this filled button deliberately breaks the rule that a coloured fill takes an inverse label — `button.styles.test.ts` asserts it so nobody "fixes" it back.
- `fieldInputClass()` in `packages/ui` is the only definition of what an input looks like. Every form used to carry its own copy of the string, which is how the shared pickers drifted into laying their labels out inline while the forms stacked them. A form that needs a different input needs an argument, not another string.
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
- User-facing text lives in `packages/i18n`. **Ukrainian is the default**, English the fallback. `uk.ts` is typed against `en.ts`, so a key added to one and forgotten in the other fails `check-types`; `catalogue.test.ts` covers what the types cannot — a Ukrainian value left as its English source.
- Ukrainian needs `_one`, `_few` and `_many` plural forms where English needs two. Omitting `_few`/`_many` does not error; i18next falls back to the singular and renders «5 витрата».
- `{{count}}` is reserved by i18next for pluralisation. A string that interpolates a plain number uses any other name — `{{min}}`, `{{max}}` — or it goes looking for plural forms that do not exist.
- `packages/domain` schemas return **translation keys**, not prose, so the package stays free of locale. Call sites pass `VALIDATION_PARAMS` to `t()` with every one; i18next ignores what a key does not reference. `apps/web/src/lib/i18n/validation-keys.test.ts` is what proves those keys exist in both catalogues.
- Both test suites are **pinned to English** through `initReactI18next.init(createI18n('en'))` in `vitest.setup.ts` and `jest.setup.js`. Production code must never register a global instance — a server render shares it across concurrent requests, so two users in different languages overwrite each other. The Ukrainian default is covered in `apps/web/e2e/locale.spec.ts`.
- The web locale is a **cookie**, not a URL segment: every screen is behind auth, so there is nothing to index and no reason to move the route tree under `[locale]`. Server components read it with `getTranslations()`; `context.clearCookies()` in an e2e spec drops the language with the session.
- Anything production needs (system categories, the service catalogue) goes in a **migration**. `supabase/seed.sql` only runs locally.
- `subscriptions.next_renewal_on` is written by the `subscriptions_set_next_renewal` trigger, never by a client, and is null while a subscription is cancelled so it drops out of what is due. The renewal arithmetic exists twice — `app.next_renewal_on` in SQL and `nextRenewalOn` in `packages/domain` — and both suites assert the same month-end cases.
- A subscription stores `anchor_day`, not its last billing date. Computing from the anchor is what makes a 31st subscription go 31 Jan → 28 Feb → 31 Mar; incrementing the previous date clamps it to the 28th and leaves it stuck there.
- `date_trunc` on a `date` widens to `timestamptz` and is only STABLE there. Cast to `::timestamp` inside anything marked IMMUTABLE, or `pnpm db:lint` flags it — and Postgres would be licensed to fold a wrong constant.
- PostgREST infers row types by parsing the select string as a type, so a column list must be **one string literal**. Building it with `+` gives `GenericStringError[]`.
- `expenses.base_amount_minor`, `fx_rate` and `fx_rate_date` are written by the `expenses_set_base_amount` trigger, never by a client — every household total is summed from that column. The trigger recomputes only when the amount, currency, date or household changes, so an ordinary edit (a soft delete included) keeps the frozen figure rather than re-rating at whatever is in `fx_rates` today.
- The money arithmetic exists twice: `app.minor_units` / `app.convert_minor` in SQL and `minorUnitsFor` / `convertMinor` in `packages/domain`. They must agree, or the figure previewed before saving is not the figure saved. Both test suites assert the same cases.
- pgTAP tests that assert exact figures must clear `public.fx_rates` first — `seed.sql` fills it, and an insert for a date the seed already covers hits the primary key.
- A currency the rate feed does not quote is **refused** at write time rather than converted at one. `listSupportedCurrencies` reads the table so the picker offers only what can actually be converted.
- Rates come from **two** feeds. The ECB quotes 30 currencies and **does not quote UAH at all**, which is why the National Bank of Ukraine feed exists alongside it — together about 44 usable currencies. Everything is stored EUR-based whichever source published it, so `app.fx_rate_on` keeps one lookup path; the ECB is written last so it wins the pairs both quote.
- The NBU feed quotes gold, silver, palladium, platinum and IMF drawing rights alongside real money. They are filtered by an explicit list, not by the X prefix — XAF, XOF and XPF are the CFA and CFP francs and are real.
- One rate feed failing is a 200 with the source named in `failed`, not an error: `app.fx_rate_on` reaches back a week, so a day-old rate beats discarding the feed that answered. A source down for longer than that window makes its currencies stop converting.
- A household has one `base_currency`, frozen once anything is recorded; a member has `profiles.display_currency`, which is null for "the household's own". The base is what every expense is converted into and summed in; the display currency is applied on the way to the screen by `useDisplayCurrency`, so two members read one ledger in two currencies and neither changes it. Every converted figure goes through `formatApprox`, which marks it `≈` — it is today's rate over amounts frozen at the rates of their own days, so it moves between one day and the next.
- `app.convert_minor` and `convertMinor` floor at one minor unit so a small amount in a weak currency cannot round away to nothing. **Zero is excepted**: expense amounts are constrained positive so it never showed there, but the same arithmetic converts household totals, and a household that spent nothing was being shown 0.01.
- The registration form passes `first_name`, `last_name` and `base_currency` as GoTrue user metadata, and `app.handle_new_user` reads them alongside Google's `given_name` / `family_name`. Metadata is client-supplied and unvalidated, so a currency that is not an ISO code falls back to USD rather than failing the signup. A second write after the session exists was the alternative and would leave a half-filled account whenever it failed.
- The currency picker on registration is `SIGNUP_CURRENCIES`, a fixed shortlist, because `fx_rates` is readable only by `authenticated` and there is no session yet. Every other currency picker reads the rate table.
- `personDisplayName` in `packages/domain` is the only place a person's name is assembled. `display_name` stays as the signup-derived fallback for magic-link accounts, which are never asked for a name — which is also why the profile screen lets a name be cleared.
