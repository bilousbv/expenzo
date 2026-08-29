import { expect, test } from '@playwright/test';

import { SIGNED_OUT_IN_ENGLISH } from './locale';

// This spec deliberately runs without the saved session, so it can prove the
// guard actually bites.
test.use({ storageState: SIGNED_OUT_IN_ENGLISH });

test.describe('authentication', () => {
  test('sends an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('rejects a malformed address before contacting the server', async ({ page }) => {
    await page.goto('/magic-link');

    const magicLink = page.getByTestId('magic-link');
    await magicLink.getByLabel(/email/i).fill('not-an-email');
    await magicLink.getByRole('button', { name: /send.*link/i }).click();

    await expect(page.getByTestId('login-error')).toContainText(/valid email/i);
  });

  /*
   * The magic link is a page of its own rather than a section of the login
   * form. Two email fields on one page were ambiguous to fill and to read, and
   * the link is a different decision from typing a password rather than a
   * variation on it.
   */
  test('asks for the magic link on a page of its own', async ({ page }) => {
    await page.goto('/login');

    await page.getByTestId('show-magic-link').click();

    await expect(page).toHaveURL(/\/magic-link$/);
    await expect(page.getByTestId('magic-link')).toBeVisible();
    // The password form is not here, so there is only one email field to fill.
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);

    await page.getByTestId('back-to-login').click();
    await expect(page).toHaveURL(/\/login$/);
  });

  // Asking for a link from a guarded URL has to land you there afterwards, not
  // on the dashboard — which means `next` has to survive the trip to this page.
  test('carries where you were heading across to the magic-link page', async ({ page }) => {
    await page.goto('/login?next=%2Fsettings%2Fprofile');

    await page.getByTestId('show-magic-link').click();

    await expect(page).toHaveURL(/\/magic-link\?next=%2Fsettings%2Fprofile$/);
  });
});
