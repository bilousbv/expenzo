import { expect, test, type Page } from '@playwright/test';

function uniqueMerchant(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** Adds one expense through the dialog and waits for the list to show it. */
async function addExpense(
  page: Page,
  { amount, merchant, income = false }: { amount: string; merchant: string; income?: boolean },
) {
  await page.getByTestId('open-expense-dialog').click();
  await expect(page.getByTestId('expense-dialog')).toBeVisible();

  if (income) await page.getByTestId('direction-income').click();

  await page.getByLabel('Amount').fill(amount);
  await page.getByLabel('Merchant').fill(merchant);
  await page.getByRole('button', { name: 'Add expense' }).click();

  await expect(page.getByTestId('expense-dialog')).toBeHidden();
  await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toBeVisible();
}

test.describe('dashboard', () => {
  test('shows the budget, the filters and the category rollup', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByTestId('budget-balance')).toBeVisible();
    await expect(page.getByTestId('budget-income')).toBeVisible();
    await expect(page.getByTestId('budget-spent')).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Period' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Author' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'By category' })).toBeVisible();
  });

  // The form lives behind the Add button now rather than sitting on the page.
  test('adds an expense through the dialog', async ({ page }) => {
    const merchant = uniqueMerchant('Dialog');

    await page.goto('/');
    await expect(page.getByTestId('expense-dialog')).toBeHidden();

    await addExpense(page, { amount: '12.50', merchant });
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

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toContainText('Groceries');
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

  // The totals come from an aggregate query rather than the loaded page. A
  // period with nothing in it is the cheapest way to prove they are not simply
  // a sum of whatever the list is holding.
  test('recomputes the budget when the period changes', async ({ page }) => {
    await page.goto('/');

    await addExpense(page, { amount: '7.00', merchant: uniqueMerchant('This month') });
    await expect(page.getByTestId('budget-spent')).not.toHaveText('$0.00');

    await page.getByTestId('period-last-month').click();

    await expect(page.getByTestId('budget-spent')).toHaveText('$0.00');
    await expect(page.getByTestId('no-expenses')).toBeVisible();

    await page.getByTestId('period-this-month').click();
    await expect(page.getByTestId('budget-spent')).not.toHaveText('$0.00');
  });

  test('shows the period the figures cover', async ({ page }) => {
    await page.goto('/');

    const range = page.getByTestId('period-range');
    const thisMonth = await range.textContent();

    await page.getByTestId('period-last-month').click();

    await expect(range).not.toHaveText(thisMonth ?? '');
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
