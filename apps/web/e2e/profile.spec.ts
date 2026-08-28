import { expect, test, type Page } from '@playwright/test';

import { SIGNED_OUT_IN_ENGLISH } from './locale';

/**
 * Names and the per-member display currency.
 *
 * Each test registers its own account rather than using the shared signed-in
 * state: changing a display currency changes what every other spec would read
 * off the dashboard, and the specs run in parallel.
 */
test.use({ storageState: SIGNED_OUT_IN_ENGLISH });

const PASSWORD = 'correct-horse-8';

function uniqueEmail() {
  return `profile-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}@expenzo.test`;
}

async function register(
  page: Page,
  { firstName, lastName, currency }: { firstName: string; lastName?: string; currency: string },
) {
  await page.goto('/register');

  await page.getByLabel('First name').fill(firstName);
  if (lastName) await page.getByLabel('Last name').fill(lastName);
  await page.getByLabel('Email').fill(uniqueEmail());
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByTestId('signup-currency').selectOption(currency);
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/$/);
}

test.describe('profile', () => {
  // The name typed at signup is what labels every expense once a second person
  // joins, so it has to survive the trigger rather than being replaced by the
  // local part of the address.
  test('keeps the name given at registration', async ({ page }) => {
    await register(page, { firstName: 'Ana', lastName: 'Petrenko', currency: 'USD' });

    await page.goto('/settings/household');

    await expect(page.getByTestId('member-name').first()).toHaveText('Ana Petrenko');
  });

  // Chosen at signup because it can never be changed afterwards: every stored
  // figure is frozen against it.
  test('opens the household in the currency chosen at registration', async ({ page }) => {
    await register(page, { firstName: 'Ira', currency: 'UAH' });

    await page.goto('/');

    // The code rather than the ₴ sign: these specs run in English, and en-US
    // renders unfamiliar currencies as their ISO code.
    await expect(page.getByTestId('budget-spent')).toContainText('UAH');
    // Its own currency needs no conversion, so nothing is marked approximate.
    await expect(page.getByTestId('budget-spent')).not.toContainText('≈');
  });

  test('edits the names afterwards', async ({ page }) => {
    await register(page, { firstName: 'Ana', currency: 'USD' });

    await page.goto('/settings/profile');
    await page.getByLabel('Last name').fill('Petrenko');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('profile-saved')).toBeVisible();

    await page.goto('/settings/household');
    await expect(page.getByTestId('member-name').first()).toHaveText('Ana Petrenko');
  });

  /**
   * The point of the whole feature: one household ledger, read in two
   * currencies. Nothing stored moves — the figures are converted at today's
   * rate for display only, which is why they are marked approximate.
   */
  test('reads the household total in the member’s own currency', async ({ page }) => {
    await register(page, { firstName: 'Ira', currency: 'USD' });

    // A real figure rather than a zero, so this proves the rate was applied
    // and not merely that the label changed.
    await page.goto('/');
    await page.getByTestId('open-expense-dialog').click();
    await page.getByLabel('Amount').fill('10.00');
    await page.getByLabel('Merchant').fill('Rate proof');
    await page.getByRole('button', { name: 'Add expense' }).click();
    await expect(page.getByTestId('expense-dialog')).toBeHidden();

    await expect(page.getByTestId('budget-spent')).toContainText('$10.00');

    await page.goto('/settings/profile');
    await page.getByTestId('display-currency').selectOption('UAH');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('profile-saved')).toBeVisible();

    await page.goto('/');
    // The code rather than the ₴ sign: en-US renders unfamiliar currencies as
    // their ISO code. Ten dollars is several hundred hryvnia, so the figure has
    // visibly been through a rate rather than merely been relabelled.
    await expect(page.getByTestId('budget-spent')).toContainText('UAH');
    await expect(page.getByTestId('budget-spent')).not.toContainText('10.00');
    // Marked approximate, because it is today's rate applied to figures frozen
    // at the rates of the days they happened.
    await expect(page.getByTestId('budget-spent')).toContainText('≈');
  });

  test('goes back to the household currency without a marker', async ({ page }) => {
    await register(page, { firstName: 'Ira', currency: 'USD' });

    await page.goto('/settings/profile');
    await page.getByTestId('display-currency').selectOption('UAH');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('profile-saved')).toBeVisible();

    await page.getByTestId('display-currency').selectOption('USD');
    await page.getByRole('button', { name: 'Save' }).click();

    await page.goto('/');
    await expect(page.getByTestId('budget-spent')).toContainText('$');
    await expect(page.getByTestId('budget-spent')).not.toContainText('≈');
  });
});
