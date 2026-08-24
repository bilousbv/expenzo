import path from 'node:path';

import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  // Required because this app's tsconfig uses `jsx: "preserve"` for Next —
  // esbuild alone would leave the JSX untransformed.
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // @expenzo/ui ships TypeScript source. Aliasing straight at the entry
      // file keeps resolution deterministic across the hoisted-linker symlink
      // and stops Vite pre-bundling it as an ordinary node_modules dependency.
      '@expenzo/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@expenzo/data': path.resolve(__dirname, '../../packages/data/src/index.ts'),
      '@expenzo/supabase-types': path.resolve(
        __dirname,
        '../../packages/supabase-types/src/index.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
    // Skip postcss/tailwind on any CSS a component pulls in.
    css: false,
    restoreMocks: true,
  },
});
