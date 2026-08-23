# Testing patterns

Where tests live in this monorepo, and what each kind looks like.

## Which runner covers what

| Workspace     | Runner         | Test location          | Covers                                               |
| ------------- | -------------- | ---------------------- | ---------------------------------------------------- |
| `packages/ui` | Vitest (jsdom) | `src/*.test.ts(x)`     | shared logic, `*.styles.ts`, the web `.tsx` variants |
| `apps/web`    | Vitest (jsdom) | `src/**/*.test.tsx`    | app components                                       |
| `apps/web`    | Playwright     | `e2e/*.spec.ts`        | browser flows against a production build             |
| `apps/mobile` | jest-expo      | `__tests__/*.test.tsx` | mobile code and the `.native.tsx` variants           |

The platform split needs no configuration to work. Vite's default
`resolve.extensions` omits `.native.tsx`, so Vitest always resolves the web
half. The `jest-expo/ios` preset orders `native.tsx` ahead of `tsx`, so jest
always resolves the native half.

**Native variants are tested from `apps/mobile`, not from `packages/ui`** — by
importing `@expenzo/ui`, which is the real integration path.

## Choosing layers

- Changed shared logic or a `*.styles.ts` → unit test in `packages/ui`.
- Changed or added a component → unit test for **both** halves: the web one in
  `packages/ui`, the native one in `apps/mobile`.
- Changed what the web app renders or how it responds → Playwright spec too.
- Changed only mobile screens → mobile test, no e2e.

## Skeletons

### Pure logic — `packages/ui/src/thing.test.ts`

```ts
import { describe, expect, it } from 'vitest';

import { thing } from './thing';

describe('thing', () => {
  it('does the expected thing', () => {
    expect(thing(1250)).toBe('$12.50');
  });
});
```

### Web component — `packages/ui/src/thing.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Thing } from './thing';

describe('Thing (web)', () => {
  it('calls onPress when clicked', async () => {
    const onPress = vi.fn();
    render(<Thing onPress={onPress}>Save</Thing>);

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Native component — `apps/mobile/__tests__/thing.test.tsx`

```tsx
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Thing } from '@expenzo/ui';

describe('Thing (native)', () => {
  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(
      <Thing testID="save" onPress={onPress}>
        Save
      </Thing>,
    );

    fireEvent.press(screen.getByTestId('save'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

Two rules specific to the native tests:

- **Import from `@jest/globals`.** Relying on injected globals would require
  `@types/jest`, which the hoisted linker leaks into every program in the repo,
  colliding with Vitest.
- **Use `toBeTruthy()`, not `toBeOnTheScreen()`.** The Testing Library matchers
  augment jest's global namespace, which needs those same types. RNTL queries
  throw when nothing matches, so truthiness gives the same guarantee.

### Browser flow — `apps/web/e2e/thing.spec.ts`

```ts
import { expect, test } from '@playwright/test';

test('does the thing', async ({ page }) => {
  await page.goto('/');

  const total = page.getByTestId('total-spent');
  await expect(total).toHaveText('$0.00');

  await page.getByRole('button', { name: 'Add $12.50' }).click();
  await expect(total).toHaveText('$12.50');
});
```

Prefer `getByRole` and `getByTestId` over `getByText`. Playwright's text lookup
matches substrings, so a currency amount will match both the total and any
button label containing it — a strict mode violation. Add a `data-testid` to the
component when there isn't a clean role to target.

## Things that will bite

- `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters` apply to
  test files. Keep them free of unused bindings.
- `Intl` output uses non-breaking spaces in some locales. Assert on the numeric
  part with `toContain` rather than matching a whole formatted string.
- Do not seed a mobile test that renders `App.tsx` — it pulls in
  `SafeAreaProvider`, which needs `initialMetrics` mocking. Render components in
  isolation.
- New Playwright specs are typechecked by `pnpm check-types`, since `apps/web`
  globs the whole directory.
