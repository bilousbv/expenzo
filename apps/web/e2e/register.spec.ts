import { expect, test } from '@playwright/test';

import { ENGLISH_COOKIE, SIGNED_OUT_IN_ENGLISH } from './locale';

/**
 * Registration and password sign-in, driven against the real auth server.
 *
 * These run signed out, so they discard the storageState the other specs share.
 */
test.use({ storageState: SIGNED_OUT_IN_ENGLISH });

function uniqueEmail() {
  return `register-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@expenzo.test`;
}

const PASSWORD = 'correct-horse-8';

test.describe('registration', () => {
  test('creates an account and lands signed in', async ({ page }) => {
    const email = uniqueEmail();

    await page.goto('/register');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    // The signup trigger creates the profile, the household and the owner
    // membership in one transaction, so the household name is the proof that
    // registration did more than mint a token.
    await expect(page).toHaveURL(/\/$/);
    await page.goto('/settings/household');
    await expect(page.getByTestId('member-name').first()).toBeVisible();
  });

  test('signs back in with the password', async ({ page, context }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/$/);

    await context.clearCookies();
    // clearCookies takes the language preference with the session, which is
    // correct behaviour and would drop the rest of this test into Ukrainian.
    await context.addCookies([ENGLISH_COOKIE]);
    await page.goto('/login');

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  // The case of an address must not create a second account: GoTrue compares
  // them lowercased, so the client has to as well.
  test('treats a differently-cased address as the same account', async ({ page, context }) => {
    const email = uniqueEmail();

    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/$/);

    await context.clearCookies();
    // clearCookies takes the language preference with the session, which is
    // correct behaviour and would drop the rest of this test into Ukrainian.
    await context.addCookies([ENGLISH_COOKIE]);
    await page.goto('/login');

    await page.getByLabel('Email').fill(email.toUpperCase());
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/$/);
  });

  test('refuses a wrong password without leaving the page', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('nobody-at-all@expenzo.test');
    await page.getByLabel('Password', { exact: true }).fill('definitely-wrong-1');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByTestId('credentials-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('rejects a mismatched confirmation before contacting the server', async ({ page }) => {
    await page.goto('/register');

    await page.getByLabel('Email').fill(uniqueEmail());
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Confirm password').fill('something-else-9');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByTestId('credentials-error')).toContainText(/do not match/i);
  });

  test('offers the magic link as an alternative', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('show-magic-link').click();

    await expect(page.getByRole('button', { name: /send.*link/i })).toBeVisible();
  });

  test('links between signing in and registering', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('go-to-register').click();
    await expect(page).toHaveURL(/\/register$/);

    await page.getByTestId('go-to-login').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  // A provider that is off produces a button that can only fail, so the buttons
  // have to match what is configured. Asserting a flat zero was the same test
  // for as long as nobody had credentials, and turned red the day someone did —
  // the flags are read here from the same .env.local the build read, so this
  // holds whether a provider is on or off.
  test('shows exactly the third-party buttons that are configured', async ({ page }) => {
    const configured = [
      process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH,
      process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH,
    ].filter((flag) => flag?.trim() === 'true');

    await page.goto('/login');

    await expect(page.getByRole('button', { name: /continue with/i })).toHaveCount(
      configured.length,
    );
  });
});
