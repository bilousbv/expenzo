# Verification reference

The gate that has to be green before anything is committed, and what the
failures actually mean.

## The gate

Run from the repo root, in this order — cheapest first, so failures surface
fast:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:e2e      # conditional, see below
```

Turbo caches every step, so a re-run after a narrow fix is quick. A second
identical run should print `FULL TURBO`.

### When to run e2e

Only when the branch's diff touches `apps/web/**` or `packages/ui/**`. Determine
it from:

```bash
git diff --name-only development...HEAD
git status --porcelain
```

E2E costs a Next production build plus a browser launch. Skipping it for a
mobile-only or config-only change turns a three-minute finish into twenty
seconds. When it is skipped, say so: _"Skipped e2e — no web-visible files
changed."_

## Per-step behaviour

### `pnpm format:check`

The only auto-fixable step. On failure run `pnpm format`, then re-run the check.
This does not count against the three-attempt budget — formatting is mechanical.

### `pnpm lint`

Fix the reported rule violations. Never run `--fix` blindly across the repo, and
never silence a rule with `eslint-disable` without saying why in chat.

### `pnpm check-types`

Fix the types. Never reach for `@ts-expect-error` or `any` to get past the gate.

Note that `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`
are all on and apply to test files too.

### `pnpm test`

Turbo runs the three workspaces in parallel and names the failing one. To narrow
down:

```bash
pnpm --filter @expenzo/ui test
pnpm --filter @expenzo/web test
pnpm --filter @expenzo/mobile test
```

### `pnpm test:e2e`

If Playwright reports missing browsers, run the install once and retry:

```bash
pnpm --filter @expenzo/web exec playwright install chromium
```

That is the one install the workflow may perform without asking — it is local,
idempotent, and fetches a tool rather than changing the project.

## Known failures

### `Unexpected token '<'` in the mobile tests

jest is not transforming the shared package's TSX. The `@expenzo/ui` entry in
`apps/mobile/jest.config.js` under `transformIgnorePatterns` is not matching.
The `moduleNameMapper` entry in the same file is the belt-and-braces fix.

Worth remembering why: jest-expo's default allowlist contains `@expo`, which
does **not** prefix-match `@expenzo` — the two diverge at the fifth character.

### A Reanimated error in the mobile tests

Add the test helper to `apps/mobile/jest.setup.js`. Check which package actually
ships `setUpTests` in Reanimated 4 first — it may live in
`react-native-worklets` rather than `react-native-reanimated`.

### `Cannot find module 'react-native'` in a Vitest run

A test under `packages/ui` or `apps/web` resolved a `.native.tsx` variant. That
should be impossible — Vite's default extension list omits `.native.*`. Check
whether someone added `.native.tsx` to `resolve.extensions`; the fix is to
remove it, not to mock react-native.

### Vitest's `expect` has the wrong type, or jest globals appear in web code

Someone installed `@types/jest`. Under `nodeLinker: hoisted`, every `@types/*`
package lands in the root `node_modules/@types` and TypeScript loads all of it
into any program without an explicit `types` array. Remove the dependency;
mobile tests import from `@jest/globals` precisely so it is never needed.

### `strict mode violation ... resolved to 2 elements` in Playwright

A text lookup matched more than one node. Currency amounts are the usual
culprit, since the same amount appears both in the total and in a button label.
Scope the assertion with `getByTestId`, adding a `data-testid` to the component
if there isn't one.

### `scopeManager.addGlobals is not a function`

ESLint 10 got into the tree. It is pinned to 9.x because `eslint-config-next`
ships a parser that crashes on 10. Check what pulled it in rather than upgrading
the config.

### An Expo dependency version complaint

```bash
pnpm --filter @expenzo/mobile exec expo install --check
```

Native dependencies must match Expo SDK 57 exactly — several want an exact pin
rather than a caret or tilde range.

## On failure

1. **Stop. Do not commit.** Nothing is committed until the whole gate is green.
2. Report the command, the workspace, and the first error verbatim.
3. Fix it, then re-run the gate **from the top**. A lint fix can break
   formatting; a type fix can break a test.
4. Three full attempts. After the third, stop and hand back with a summary of
   what still fails and what was tried. Do not keep grinding.

Never use `--no-verify`, `.skip`, `.only`, `test.fixme`, a deleted assertion, or
a loosened matcher to reach green. When a pre-existing and unrelated test fails,
say so explicitly and ask whether to fix it here or park it.
