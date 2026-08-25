import path from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @expenzo/domain ships TypeScript source. Aliasing straight at the entry
      // file keeps resolution deterministic across the hoisted-linker symlink.
      '@expenzo/domain': path.resolve(__dirname, '../domain/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
  },
});
