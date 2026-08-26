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
    await page.goto('/login');

    await page.getByTestId('show-magic-link').click();

    // Scoped to the magic-link section: the password form on the same page has
    // its own email field.
    const magicLink = page.getByTestId('magic-link');
    await magicLink.getByLabel(/email/i).fill('not-an-email');
    await magicLink.getByRole('button', { name: /send.*link/i }).click();

    await expect(page.getByTestId('login-error')).toContainText(/valid email/i);
  });
});
