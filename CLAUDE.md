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
