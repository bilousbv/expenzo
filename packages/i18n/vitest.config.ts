import { defineConfig } from 'vitest/config';

// Node environment: this package is catalogues and an i18next factory. The
// React binding it re-exports is not rendered here — the components that use it
// are tested in packages/ui, apps/web and apps/mobile.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
