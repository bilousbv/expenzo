import { expect, test, type Page } from '@playwright/test';

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Adds one subscription and waits for the list to show it. */
async function addSubscription(
  page: Page,
  {
    name,
    amount,
    cadence,
    trialDays,
  }: { name: string; amount: string; cadence?: string; trialDays?: string },
) {
  await page.getByTestId('open-subscription-dialog').click();

  await page.getByTestId('subscription-name').fill(name);
  await page.getByLabel('Amount').fill(amount);
  if (cadence) await page.getByTestId('subscription-cadence').selectOption(cadence);
  if (trialDays) {
    await page.getByTestId('subscription-trial').check();
    await page.getByTestId('subscription-trial-days').fill(trialDays);
  }
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
    await page.getByTestId('open-subscription-dialog').click();

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
    await page.getByTestId('open-subscription-dialog').click();

    await page.getByLabel('Amount').fill('9.99');
    await page.getByTestId('subscription-submit').click();

    await expect(page.getByTestId('subscription-error')).toBeVisible();
  });
  /*
   * The dashboard card is the only place a charge is shown before it is taken,
   * so it is the one thing between a household and a renewal it forgot about.
   * A weekly subscription started today bills exactly a week out, which is the
   * far edge of the window — the case that would be dropped by an exclusive
   * bound.
   */
  test('shows what renews this week on the dashboard', async ({ page }) => {
    const name = uniqueName('Weekly');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '5', cadence: 'weekly' });

    await page.goto('/');

    const row = page.getByTestId('renewal-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('renewal-when')).toHaveText('in 7 days');
  });

  // A card that showed everything would be the subscriptions screen with worse
  // ordering. What earns the space is that everything on it is imminent.
  test('leaves a charge a month away off it', async ({ page }) => {
    const name = uniqueName('Monthly');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '7', cadence: 'monthly' });

    await page.goto('/');

    await expect(page.getByTestId('renewals-card')).toBeVisible();
    await expect(page.getByTestId('renewal-row').filter({ hasText: name })).toHaveCount(0);
  });
  /*
   * A dialog rather than a form sitting permanently above the list. Adding a
   * subscription is something a household does a handful of times a year, and
   * the list is what the screen is for the rest of the time.
   */
  test('adds one through a dialog that closes afterwards', async ({ page }) => {
    const name = uniqueName('Dialog');

    await page.goto('/subscriptions');
    await expect(page.getByTestId('subscription-name')).toHaveCount(0);

    await addSubscription(page, { name, amount: '4' });

    await expect(page.getByTestId('subscription-dialog')).toBeHidden();
  });

  /*
   * Its own taxonomy: "Streaming" answers what a household pays for every
   * month, which is not the question the expense categories answer.
   */
  test('files a subscription against the subscription categories', async ({ page }) => {
    await page.goto('/subscriptions');
    await page.getByTestId('open-subscription-dialog').click();

    const picker = page.getByTestId('category-select');
    await expect(picker.getByRole('option', { name: 'Streaming' })).toHaveCount(1);
    await expect(picker.getByRole('option', { name: 'Groceries' })).toHaveCount(0);
  });

  /*
   * The trial end is the first charge, so the card shows one date and calls it
   * what it is: the day cancelling stops being free.
   */
  test('shows a trial ending on the dashboard', async ({ page }) => {
    const name = uniqueName('Trial');

    await page.goto('/subscriptions');
    await addSubscription(page, { name, amount: '9', trialDays: '3' });

    await expect(
      page
        .getByTestId('subscription-row')
        .filter({ hasText: name })
        .getByTestId('subscription-next'),
    ).toContainText('Free until');

    await page.goto('/');

    const row = page.getByTestId('renewal-row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('renewal-when')).toContainText(/trial ends/i);
  });
});
