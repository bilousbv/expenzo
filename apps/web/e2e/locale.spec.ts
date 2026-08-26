import { expect, test } from '@playwright/test';

/**
 * The rest of the suite pins itself to English so its assertions stay readable
 * — see e2e/locale.ts. That leaves the actual default untested, which is the
 * part a user meets first, so it is tested here where it is the subject rather
 * than the backdrop.
 */
test.describe('the default language', () => {
  // No locale cookie at all: a browser that has never been here before.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('serves Ukrainian to a visitor who has expressed no preference', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Вхід до Expenzo' })).toBeVisible();
  });

  // Not decoration: this is what tells a screen reader which voice to read the
  // page in, and it was hard-coded to "en" before this existed.
  test('declares the language on the document', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('html')).toHaveAttribute('lang', 'uk');
  });

  test('translates the form, not just the heading', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Пароль', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Увійти' })).toBeVisible();
  });
});

test.describe('switching language', () => {
  // Inherits the shared signed-in state, which carries the English cookie.
  test('changes the language of the whole app, not just the switcher', async ({ page }) => {
    await page.goto('/settings/household');

    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    await page.getByTestId('language-select').selectOption('uk');

    // The heading is rendered by a server component, so it only changes once
    // the server has re-rendered with the new cookie. If this passes while the
    // select alone changed, the cookie was written but nothing was refreshed.
    await expect(page.getByRole('heading', { name: 'Учасники' })).toBeVisible();
  });

  test('remembers the choice on the next page', async ({ page }) => {
    await page.goto('/settings/household');
    await page.getByTestId('language-select').selectOption('uk');
    await expect(page.getByRole('heading', { name: 'Учасники' })).toBeVisible();

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Витрати' })).toBeVisible();
  });

  test('offers each language written in itself', async ({ page }) => {
    await page.goto('/settings/household');

    // Someone who cannot read the language currently on screen still has to be
    // able to find their own in the list.
    await expect(page.getByTestId('language-select')).toContainText('Українська');
    await expect(page.getByTestId('language-select')).toContainText('English');
  });
});
