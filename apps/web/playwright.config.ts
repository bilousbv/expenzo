import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

// Playwright does not read .env.local on its own. Using Next's own loader means
// the tests and the app resolve environment variables identically.
loadEnvConfig(process.cwd());

// Deliberately not 3000, so a running `pnpm dev` is never hijacked by
// `reuseExistingServer`. 127.0.0.1 rather than localhost avoids the IPv6
// resolution stall Windows hits on first connect.
const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // Signs in once through the real magic-link flow and saves the cookies.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'e2e/.auth/user.json' },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // Building is turbo's job (`test:e2e` dependsOn `build`), so this only
    // starts the already-built app — and exercises the production bundle.
    command: `pnpm exec next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
    // next start does not read .env.local, so the Supabase values have to be
    // handed through explicitly or every request 500s on a missing variable.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    },
  },
});
