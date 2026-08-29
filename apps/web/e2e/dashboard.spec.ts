import { expect, test, type Page } from '@playwright/test';

function uniqueMerchant(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Adds one expense through the dialog. The dashboard lists none, so the
 *  proof it landed is the rollup or the figures above it. */
async function addExpense(
  page: Page,
  { amount, merchant, income = false }: { amount: string; merchant: string; income?: boolean },
) {
  // The figure this add is going to move. Waiting for it to change afterwards
  // is what replaces the row that used to appear on this page: without a
  // barrier the next assertion races the summary refetch.
  const total = page.getByTestId(income ? 'budget-income' : 'budget-spent');
  await expect(total).not.toBeEmpty();
  const before = await total.textContent();

  await page.getByTestId('open-expense-dialog').click();
  await expect(page.getByTestId('expense-dialog')).toBeVisible();

  if (income) await page.getByTestId('direction-income').click();

  await page.getByLabel('Amount').fill(amount);
  // Income has no merchant field at all — money arriving has no shop.
  if (!income) await page.getByLabel('Merchant').fill(merchant);
  await page.getByRole('button', { name: 'Add expense' }).click();

  await expect(page.getByTestId('expense-dialog')).toBeHidden();
  await expect(total).not.toHaveText(before ?? '');
}

/** Opens a category from the rollup, which is the only way into its expenses. */
async function openCategory(page: Page, name: string) {
  await page.getByTestId('category-row').filter({ hasText: name }).click();
  await expect(page.getByTestId('category-title')).toHaveText(name);
}

test.describe('dashboard', () => {
  test('shows the budget, the filters and the category rollup', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('budget-balance')).toBeVisible();
    await expect(page.getByTestId('budget-income')).toBeVisible();
    await expect(page.getByTestId('budget-spent')).toBeVisible();
    await expect(page.getByTestId('period-bar')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Author' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By category' })).toBeVisible();
  });

  // The form lives behind the Add button now rather than sitting on the page.
  test('adds an expense through the dialog', async ({ page }) => {
    const merchant = uniqueMerchant('Dialog');

    await page.goto('/');
    await expect(page.getByTestId('expense-dialog')).toBeHidden();

    await addExpense(page, { amount: '12.50', merchant });

    // The dashboard is a summary, so the expense is proved by opening the
    // category it landed in rather than by a row appearing here.
    await openCategory(page, 'Uncategorised');
    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toBeVisible();
  });

  // Escape closing a <dialog> is the behaviour the native element gives for
  // free, and the reason it is used rather than a hand-rolled overlay.
  test('closes the dialog on Escape', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('open-expense-dialog').click();
    await expect(page.getByTestId('expense-dialog')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByTestId('expense-dialog')).toBeHidden();
  });

  test('picks a category from the dropdown', async ({ page }) => {
    const merchant = uniqueMerchant('Dropdown');

    await page.goto('/');
    await page.getByTestId('open-expense-dialog').click();

    await page.getByLabel('Amount').fill('8.00');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByLabel('Category').selectOption({ label: 'Groceries' });
    await page.getByRole('button', { name: 'Add expense' }).click();

    await expect(page.getByTestId('expense-dialog')).toBeHidden();

    // The point of the dropdown is that the expense lands in that category, and
    // the rollup is now where that is visible.
    await openCategory(page, 'Groceries');
    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toBeVisible();
  });

  // The arithmetic this design exists to get right: income moves the balance up
  // by its own amount, not down, and not by twice it.
  test('records income and moves the budget by that amount', async ({ page }) => {
    await page.goto('/');

    const balance = page.getByTestId('budget-balance');
    await expect(balance).not.toBeEmpty();
    const before = await balance.textContent();

    await addExpense(page, { amount: '100.00', merchant: uniqueMerchant('Salary'), income: true });

    await expect(balance).not.toHaveText(before ?? '');
    await expect(page.getByTestId('budget-income')).not.toHaveText('$0.00');
  });

  test('counts spending against the budget', async ({ page }) => {
    await page.goto('/');

    await addExpense(page, { amount: '5.00', merchant: uniqueMerchant('Coffee') });

    await expect(page.getByTestId('budget-spent')).not.toHaveText('$0.00');
    await expect(page.getByTestId('category-row').first()).toBeVisible();
  });
  /** Opens the picker and takes a preset from it. */
  async function choosePreset(page: Page, preset: string) {
    await page.getByTestId('period-open').click();
    await expect(page.getByTestId('period-dialog')).toBeVisible();
    await page.getByTestId(`preset-${preset}`).click();
    await expect(page.getByTestId('period-dialog')).toBeHidden();
  }

  // The totals come from an aggregate query rather than the loaded page. A
  // period with nothing in it is the cheapest way to prove they are not simply
  // a sum of whatever the list is holding.
  test('recomputes the budget when the period changes', async ({ page }) => {
    await page.goto('/');

    await addExpense(page, { amount: '7.00', merchant: uniqueMerchant('This month') });
    await expect(page.getByTestId('budget-spent')).not.toHaveText('$0.00');

    await choosePreset(page, 'last-month');

    await expect(page.getByTestId('budget-spent')).toHaveText('$0.00');
    // The rollup is what empties now; the dashboard holds no list to empty.
    await expect(page.getByTestId('no-category-spend')).toBeVisible();

    await choosePreset(page, 'this-month');
    await expect(page.getByTestId('budget-spent')).not.toHaveText('$0.00');
  });

  test('shows the period the figures cover', async ({ page }) => {
    await page.goto('/');

    const dates = page.getByTestId('period-dates');
    const thisMonth = await dates.textContent();

    await choosePreset(page, 'last-month');

    await expect(dates).not.toHaveText(thisMonth ?? '');
  });

  /*
   * The period is in the URL, so it survives a reload and can be sent to
   * somebody else — and the category drill-down reads the same two parameters.
   */
  test('keeps the period in the address and across a reload', async ({ page }) => {
    await page.goto('/');
    await choosePreset(page, 'last-month');

    await expect(page).toHaveURL(/from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}/);
    const shown = await page.getByTestId('period-dates').textContent();

    await page.reload();

    await expect(page.getByTestId('period-dates')).toHaveText(shown ?? '');
  });

  /*
   * The arrows step by whatever unit the period is, so they work the same way
   * on a month, a quarter, a year and a week. An arbitrary range has no unit,
   * which is what hides them.
   */
  test('steps between months with the arrows', async ({ page }) => {
    await page.goto('/');

    const dates = page.getByTestId('period-dates');
    const thisMonth = await dates.textContent();

    await page.getByTestId('period-previous').click();
    await expect(dates).not.toHaveText(thisMonth ?? '');

    await page.getByTestId('period-next').click();
    await expect(dates).toHaveText(thisMonth ?? '');
  });

  /*
   * Stepping is not month-only. A quarter steps by a quarter and a year by a
   * year, which is the difference between the arrows being a month control and
   * being a period control.
   */
  for (const preset of ['this-quarter', 'this-year', 'this-week']) {
    test(`steps by the unit of ${preset}`, async ({ page }) => {
      await page.goto('/');
      await choosePreset(page, preset);

      const dates = page.getByTestId('period-dates');
      const before = await dates.textContent();

      // Present at all is the point: a quarter or a year used to hide them.
      await expect(page.getByTestId('period-previous')).toBeVisible();

      await page.getByTestId('period-previous').click();
      await expect(dates).not.toHaveText(before ?? '');

      // And stepping back has to land exactly where it started, or the arrows
      // drift a day at a time.
      await page.getByTestId('period-next').click();
      await expect(dates).toHaveText(before ?? '');
    });
  }

  test('hides the arrows once a custom range is picked', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('period-previous')).toBeVisible();

    await page.getByTestId('period-open').click();
    await page.getByTestId('period-from').fill('2026-01-05');
    await page.getByTestId('period-to').fill('2026-02-14');
    await page.getByTestId('period-apply').click();

    await expect(page.getByTestId('period-dialog')).toBeHidden();
    await expect(page.getByTestId('period-previous')).toBeHidden();
    await expect(page.getByTestId('period-next')).toBeHidden();
  });

  // Refused rather than quietly swapped: a reversed range is a typo, and
  // reinterpreting it hides which end was wrong.
  test('refuses a range that ends before it starts', async ({ page }) => {
    await page.goto('/');

    await page.getByTestId('period-open').click();
    await page.getByTestId('period-from').fill('2026-03-01');
    await page.getByTestId('period-to').fill('2026-01-01');

    await expect(page.getByTestId('period-error')).toBeVisible();
    await expect(page.getByTestId('period-apply')).toBeDisabled();
  });
});

test.describe('what was saved', () => {
  test('sits under the balance panel and follows the period', async ({ page }) => {
    await page.goto('/');

    const card = page.getByTestId('saved-card');
    await expect(card).toBeVisible();

    const before = await card.getByTestId('saved-amount').textContent();

    await addExpense(page, { amount: '40.00', merchant: uniqueMerchant('Saved'), income: true });

    // Income raises what was kept, so the figure has to move with it.
    await expect(card.getByTestId('saved-amount')).not.toHaveText(before ?? '');
  });

  /*
   * A period with nothing in it kept nothing, which is still a figure rather
   * than an empty card.
   */
  test('shows a figure for a period with nothing in it', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('period-open').click();
    await page.getByTestId('preset-last-year').click();

    await expect(page.getByTestId('saved-amount')).not.toBeEmpty();
  });
});

test.describe('spending limits', () => {
  test('sets a limit and shows it against the category', async ({ page }) => {
    const merchant = uniqueMerchant('Limited');

    await page.goto('/');
    await addExpense(page, { amount: '3.00', merchant });

    await page.goto('/settings/limits');
    await page.getByLabel('Category').selectOption({ label: 'Groceries' });
    await page.getByLabel('Monthly limit').fill('500');
    await page.getByRole('button', { name: 'Set limit' }).click();

    // Scoped to the Groceries row: specs run in parallel against one household,
    // so another spec's limit can be sitting above this one in the list.
    const row = page.getByTestId('limit-row').filter({ hasText: 'Groceries' });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('limit-amount')).toHaveText('$500.00');
  });

  // Hitting the unique index is not something the user can act on as Postgres
  // states it, so it is translated into an instruction.
  test('refuses a second limit for the same category', async ({ page }) => {
    await page.goto('/settings/limits');

    await page.getByLabel('Category').selectOption({ label: 'Dining out' });
    await page.getByLabel('Monthly limit').fill('100');
    await page.getByRole('button', { name: 'Set limit' }).click();
    await expect(page.getByTestId('limit-row').filter({ hasText: 'Dining out' })).toBeVisible();

    await page.getByLabel('Category').selectOption({ label: 'Dining out' });
    await page.getByLabel('Monthly limit').fill('200');
    await page.getByRole('button', { name: 'Set limit' }).click();

    await expect(page.getByTestId('limit-error')).toContainText(/change it instead/i);
  });

  test('refuses a limit of zero', async ({ page }) => {
    await page.goto('/settings/limits');

    await page.getByLabel('Monthly limit').fill('0');
    await page.getByRole('button', { name: 'Set limit' }).click();

    await expect(page.getByTestId('limit-error')).toBeVisible();
  });
});

test.describe('navigation', () => {
  /*
   * The header used to live inside the dashboard's gradient panel, which meant
   * it existed on exactly one page: every settings screen was a dead end you
   * could only leave with the browser's back button.
   */
  for (const path of ['/', '/subscriptions', '/settings/limits', '/settings/profile']) {
    test(`shows the header on ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page.getByRole('navigation')).toBeVisible();
      await expect(page.getByTestId('go-home')).toBeVisible();
    });
  }

  test('gets back to the dashboard from a settings page', async ({ page }) => {
    await page.goto('/settings/limits');

    await page.getByTestId('go-home').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('budget-balance')).toBeVisible();
  });
});

test.describe('category expenses', () => {
  // The dashboard is a summary now. Item by item lives one level down.
  test('lists no expenses on the dashboard itself', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('budget-balance')).toBeVisible();
    await expect(page.getByTestId('expense-row')).toHaveCount(0);
  });

  test('opens a category and comes back', async ({ page }) => {
    await page.goto('/');
    await addExpense(page, { amount: '6.00', merchant: uniqueMerchant('Drilldown') });

    await openCategory(page, 'Uncategorised');
    // The period travels with the link rather than resetting to this month.
    await expect(page.getByTestId('category-range')).toBeVisible();

    await page.getByTestId('back-to-dashboard').click();
    await expect(page).toHaveURL(/\/$/);
  });
});
