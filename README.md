# Expenzo

Turborepo monorepo sharing components between a Next.js web app and a React Native (Expo) mobile app.

## Layout

```
apps/
  web/                 Next.js 16, App Router, Tailwind CSS
  mobile/              Expo SDK 57 / React Native 0.86, NativeWind
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

## Testing

| Workspace     | Runner                      | Covers                                                        |
| ------------- | --------------------------- | ------------------------------------------------------------- |
| `packages/ui` | Vitest (jsdom)              | shared logic and the web `.tsx` component variants            |
| `apps/web`    | Vitest (jsdom) + Playwright | app components and browser end-to-end flows                   |
| `apps/mobile` | jest-expo                   | mobile code and the `.native.tsx` variants, via `@expenzo/ui` |

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

## Notes

- pnpm uses `nodeLinker: hoisted` (see `pnpm-workspace.yaml`) because Metro does
  not follow pnpm's symlinked store reliably.
- Native dependency versions are pinned to what Expo SDK 57 expects; verify with
  `pnpm --filter @expenzo/mobile exec expo install --check`.
- The shared ESLint config avoids type-aware rules, since `eslint-config-next`
  substitutes its own parser that does not forward `parserOptions.project`.
- Never add `@types/jest`. The hoisted linker puts every `@types/*` package in
  the root `node_modules/@types`, where TypeScript picks it up for every
  program — jest's global `expect` would then collide with Vitest's. Mobile
  tests import from `@jest/globals` instead.
