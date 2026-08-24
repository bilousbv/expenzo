import { defineConfig } from 'vitest/config';

// Node environment on purpose: this package has no React and no DOM, so it
// needs neither jsdom nor the React plugin. These are the cheapest and fastest
// tests in the repo, which is where most of the domain logic should be proven.
export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
  },
});
