# CLAUDE.md

## Caveman mode

Use the caveman plugin for every message in this repo to reduce token usage. Activate caveman mode (full intensity) at session start and keep it on for all responses — terse output, full technical accuracy, no filler. See `/caveman` for controls (`lite|full|ultra|off`).

## Repo

Turborepo monorepo, pnpm workspaces. `apps/web` (Next.js), `apps/mobile` (Expo), `packages/ui` (shared components), plus shared tailwind/tsconfig/eslint config packages. See [README.md](README.md) for the layout and the component-sharing convention.

Verify changes with `pnpm lint`, `pnpm check-types` and `pnpm build` from the root.

### Constraints worth remembering

- pnpm runs with `nodeLinker: hoisted`; Metro breaks under the default symlinked store.
- Mobile native dependency versions must match Expo SDK 57 exactly — check with `pnpm --filter @expenzo/mobile exec expo install --check` after touching them.
- ESLint is pinned to 9.x: `eslint-config-next` ships a parser that crashes on ESLint 10.
- The shared ESLint config uses no type-aware rules, because `eslint-config-next` swaps in a parser that does not forward `parserOptions.project`.
- Shared components are split `Foo.tsx` (web) / `Foo.native.tsx` (native) around a common `Foo.styles.ts`. Add both halves when adding a component.
