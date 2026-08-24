import { expect, test } from '@playwright/test';

// This spec deliberately runs without the saved session, so it can prove the
// guard actually bites.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('authentication', () => {
  test('sends an unauthenticated visitor to the login page', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('rejects a malformed address before contacting the server', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('not-an-email');
    await page.getByRole('button', { name: /send.*link/i }).click();

    await expect(page.getByTestId('login-error')).toContainText(/valid email/i);
  });
});
