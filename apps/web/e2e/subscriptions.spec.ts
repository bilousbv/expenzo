import { expect, test, type Page } from '@playwright/test';

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Adds one subscription and waits for the list to show it. */
async function addSubscription(
  page: Page,
  { name, amount, cadence }: { name: string; amount: string; cadence?: string },
) {
  await page.getByTestId('subscription-name').fill(name);
  await page.getByLabel('Amount').fill(amount);
  if (cadence) await page.getByTestId('subscription-cadence').selectOption(cadence);
  await page.getByTestId('subscription-submit').click();

  await expect(page.getByTestId('subscription-row').filter({ hasText: name })).toBeVisible();
}

test.describe('subscriptions', () => {
  test('is reachable from the dashboard', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Subscriptions' }).click();

    await expect(page).toHaveURL(/\/subscriptions$/);
    await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible();
  });

  test('records a subscription and shows when it next bills', async ({ page }) => {
    const name = uniqueName('Streaming');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '15.99' });

    const row = page.getByTestId('subscription-row').filter({ hasText: name });

    await expect(row.getByTestId('subscription-amount')).toHaveText('$15.99');
    // Derived by the trigger, so its presence is what proves the schedule was
    // computed at all rather than left for a client to guess.
    await expect(row.getByTestId('subscription-next')).toContainText(/Next \d{4}-\d{2}-\d{2}/);
  });

  test('carries the billing cycle that was chosen', async ({ page }) => {
    const name = uniqueName('Domain');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '12', cadence: 'yearly' });

    await expect(page.getByTestId('subscription-row').filter({ hasText: name })).toContainText(
      'Yearly',
    );
  });

  // The catalogue's whole purpose until the email parsing lands: making the
  // common case one tap rather than typing a name everybody shares.
  test('fills the name from the service catalogue', async ({ page }) => {
    await page.goto('/subscriptions');

    await page.getByTestId('subscription-service').selectOption({ label: 'Netflix' });

    await expect(page.getByTestId('subscription-name')).toHaveValue('Netflix');
  });

  test('cancels a subscription without losing it', async ({ page }) => {
    const name = uniqueName('Gym');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '30' });

    const row = page.getByTestId('subscription-row').filter({ hasText: name });
    await row.getByTestId('subscription-toggle').click();

    // Still listed — months of charges are history — but no longer due.
    await expect(row.getByTestId('subscription-next')).toHaveText('Cancelled');
  });

  test('reactivates a cancelled one and the schedule comes back', async ({ page }) => {
    const name = uniqueName('Paper');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '5' });

    const row = page.getByTestId('subscription-row').filter({ hasText: name });
    await row.getByTestId('subscription-toggle').click();
    await expect(row.getByTestId('subscription-next')).toHaveText('Cancelled');

    await row.getByTestId('subscription-toggle').click();
    await expect(row.getByTestId('subscription-next')).toContainText(/Next \d{4}-\d{2}-\d{2}/);
  });

  test('removes one from the list', async ({ page }) => {
    const name = uniqueName('Trial');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '1' });

    const row = page.getByTestId('subscription-row').filter({ hasText: name });
    await row.getByRole('button', { name: `Delete ${name}` }).click();

    await expect(page.getByTestId('subscription-row').filter({ hasText: name })).toHaveCount(0);
  });

  test('refuses one with no name', async ({ page }) => {
    await page.goto('/subscriptions');

    await page.getByLabel('Amount').fill('9.99');
    await page.getByTestId('subscription-submit').click();

    await expect(page.getByTestId('subscription-error')).toBeVisible();
  });
});
