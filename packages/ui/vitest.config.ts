import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vite's default `resolve.extensions` omits `.native.tsx`, so imports here
// resolve to the web variant of each component. Do not add `.native.*` —
// the React Native halves are covered from apps/mobile under jest-expo.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    restoreMocks: true,
  },
});
