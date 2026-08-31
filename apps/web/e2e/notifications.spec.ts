import { expect, test } from '@playwright/test';

/**
 * Unique per run, and load-bearing rather than tidiness.
 *
 * `limit_period_state` records that a limit has already been reported broken
 * for a period, which is the whole point of the feature — so a limit reused
 * between runs would correctly notify nobody the second time. A fresh category
 * with a fresh limit is what makes the crossing a first crossing.
 */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/*
 * Serial, and not merely for tidiness. The preference test turns in-app
 * delivery off for the whole account while it runs, and 'mark all read' asserts
 * an empty inbox — either would be decided by a coin toss against the tests
 * above them running at the same time.
 */
test.describe.configure({ mode: 'serial' });

test.describe('limit notifications', () => {
  test('tells the household when a limit is crossed', async ({ page }) => {
    const category = uniqueName('Alerting');

    await page.goto('/settings/categories');
    await page.getByLabel('Name').fill(category);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByTestId('custom-category').filter({ hasText: category })).toBeVisible();

    await page.goto('/settings/limits');
    await page.getByLabel('Category').selectOption({ label: category });
    await page.getByLabel('Monthly limit').fill('1');
    await page.getByRole('button', { name: 'Set limit' }).click();
    await expect(page.getByTestId('limit-row').filter({ hasText: category })).toBeVisible();

    // Five times the limit, so the crossing is not a rounding argument.
    await page.goto('/');
    const spent = page.getByTestId('budget-spent');
    await expect(spent).not.toBeEmpty();
    const before = await spent.textContent();

    await page.getByTestId('open-expense-dialog').click();
    await page.getByLabel('Amount').fill('5.00');
    await page.getByLabel('Merchant').fill(uniqueName('Over'));
    await page.getByLabel('Category').selectOption({ label: category });
    await page.getByRole('button', { name: 'Add expense' }).click();
    await expect(spent).not.toHaveText(before ?? '');

    // The queue is drained by the header, which is on every page — so the badge
    // appears without ever visiting the notification centre.
    await page.reload();
    await expect(page.getByTestId('notification-badge')).toBeVisible();

    await page.getByTestId('go-to-notifications').click();
    await expect(page.getByTestId('notification-line').filter({ hasText: category })).toContainText(
      '$5.00 of $1.00',
    );
  });

  /*
   * Crossing a limit is an event, not a standing condition. Without
   * `limit_period_state` every expense for the rest of the month would also be
   * "over the limit", and the centre would fill up with the same news.
   */
  test('says it once, however much more is spent', async ({ page }) => {
    const category = uniqueName('Once');

    await page.goto('/settings/categories');
    await page.getByLabel('Name').fill(category);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByTestId('custom-category').filter({ hasText: category })).toBeVisible();

    await page.goto('/settings/limits');
    await page.getByLabel('Category').selectOption({ label: category });
    await page.getByLabel('Monthly limit').fill('1');
    await page.getByRole('button', { name: 'Set limit' }).click();
    await expect(page.getByTestId('limit-row').filter({ hasText: category })).toBeVisible();

    for (const amount of ['5.00', '6.00']) {
      await page.goto('/');
      const spent = page.getByTestId('budget-spent');
      await expect(spent).not.toBeEmpty();
      const before = await spent.textContent();

      await page.getByTestId('open-expense-dialog').click();
      await page.getByLabel('Amount').fill(amount);
      await page.getByLabel('Merchant').fill(uniqueName('Spend'));
      await page.getByLabel('Category').selectOption({ label: category });
      await page.getByRole('button', { name: 'Add expense' }).click();
      await expect(spent).not.toHaveText(before ?? '');
    }

    await page.goto('/notifications');
    await expect(page.getByTestId('notification-line').filter({ hasText: category })).toHaveCount(
      1,
    );
  });

  test('marks everything read and keeps it that way', async ({ page }) => {
    await page.goto('/notifications');

    const markAll = page.getByTestId('notifications-read-all');
    if (await markAll.isVisible()) {
      await markAll.click();
    }

    await expect(markAll).toBeHidden();
    await expect(page.getByTestId('notification-unread-count')).toBeHidden();

    await page.reload();
    await expect(page.getByTestId('notification-unread-count')).toBeHidden();
  });

  /*
   * Restored in a `finally`, and that is not politeness. The preference is
   * account-wide: leaving it off suppresses every delivery, so a failure here
   * would turn every notification assertion in this file into a mystery on the
   * next run — which is exactly what happened the first time this was written.
   */
  test('turns the alert off from its settings page', async ({ page }) => {
    await page.goto('/settings/notifications');

    const toggle = page.getByTestId('preference-limit_exceeded');
    await expect(toggle).toBeChecked();

    try {
      await toggle.uncheck();
      await page.reload();

      // Survives a reload, which a purely optimistic update would not.
      await expect(page.getByTestId('preference-limit_exceeded')).not.toBeChecked();
    } finally {
      await page.goto('/settings/notifications');
      const restored = page.getByTestId('preference-limit_exceeded');

      if (!(await restored.isChecked())) await restored.check();
      await expect(restored).toBeChecked();
    }
  });
});
