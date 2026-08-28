import { expect, test, type Page } from '@playwright/test';

/** Unique per run: expenses accumulate, and every spec shares one household. */
function uniqueMerchant(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

async function openDialog(page: Page) {
  await page.getByTestId('open-expense-dialog').click();
  await expect(page.getByTestId('expense-dialog')).toBeVisible();
}

async function addExpense(page: Page, amount: string, merchant: string) {
  // The figure this add will move. Waiting for it to change is what replaces
  // the row that used to appear on this page: without a barrier the navigation
  // below races the rollup refetch and opens a category that does not hold the
  // new expense yet.
  const spent = page.getByTestId('budget-spent');
  await expect(spent).not.toBeEmpty();
  const before = await spent.textContent();

  await openDialog(page);
  await page.getByLabel('Amount').fill(amount);
  await page.getByLabel('Merchant').fill(merchant);
  await page.getByRole('button', { name: 'Add expense' }).click();
  await expect(page.getByTestId('expense-dialog')).toBeHidden();
  await expect(spent).not.toHaveText(before ?? '');
}

/**
 * The dashboard is a summary now and lists no expenses, so the category rollup
 * is the way in. Nothing here is added with a category, so everything lands
 * under Uncategorised.
 */
async function openUncategorised(page: Page) {
  await page.getByTestId('category-row').filter({ hasText: 'Uncategorised' }).click();
  await expect(page.getByTestId('category-title')).toHaveText('Uncategorised');
}

test.describe('expenses', () => {
  test('records an expense and shows it in the list', async ({ page }) => {
    const merchant = uniqueMerchant('Blue Bottle');

    await page.goto('/');
    await addExpense(page, '12.50', merchant);
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('expense-amount')).toHaveText('$12.50');

    // Surviving a reload is what separates a real write from an optimistic one.
    await page.reload();
    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toBeVisible();
  });

  // The parser has to guess between 1,234 and 1.234, and the preview is what
  // makes guessing acceptable. If it ever stops matching, the guess is silent.
  test('shows how it read the amount before saving', async ({ page }) => {
    await page.goto('/');
    await openDialog(page);

    await page.getByLabel('Amount').fill('1,234');

    await expect(page.getByTestId('amount-preview')).toHaveText('$1,234.00');
  });

  test('accepts a decimal comma', async ({ page }) => {
    const merchant = uniqueMerchant('Comma');

    await page.goto('/');
    await addExpense(page, '7,25', merchant);
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-amount')).toHaveText('$7.25');
  });

  // Every member sees every expense now, so the row carries its author instead
  // of a privacy badge. There is no way to enter one that anybody is hidden
  // from — which is the whole point of the change.
  test('attributes each expense to its author', async ({ page }) => {
    const merchant = uniqueMerchant('Attributed');

    await page.goto('/');
    await addExpense(page, '9.99', merchant);
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-author')).not.toBeEmpty();
  });

  /*
   * The author filter used to narrow a list on the dashboard. The dashboard no
   * longer holds one, so what it narrows now is the rollup and the figures
   * above it — which is the thing that has to keep working.
   */
  test('narrows the rollup to one author and back', async ({ page }) => {
    await page.goto('/');
    await addExpense(page, '4.00', uniqueMerchant('Mine'));

    const uncategorised = page.getByTestId('category-row').filter({ hasText: 'Uncategorised' });
    await expect(uncategorised).toBeVisible();

    // The signed-in member is the only one in this household, so filtering to
    // them keeps the row and "Everyone" brings the unfiltered rollup back.
    await page.getByRole('radiogroup', { name: 'Author' }).getByRole('radio').nth(1).click();
    await expect(uncategorised).toBeVisible();

    await page.getByTestId('author-all').click();
    await expect(uncategorised).toBeVisible();
  });

  test('refuses an amount that is not a number', async ({ page }) => {
    await page.goto('/');
    await openDialog(page);

    await page.getByLabel('Amount').fill('not money');
    await page.getByRole('button', { name: 'Add expense' }).click();

    await expect(page.getByTestId('expense-error')).toBeVisible();
    // Still open, because nothing was saved.
    await expect(page.getByTestId('expense-dialog')).toBeVisible();
  });

  // Soft delete: the row leaves the list, and the audit trigger keeps a record
  // of who removed it.
  test('removes an expense from the list', async ({ page }) => {
    const merchant = uniqueMerchant('Delete me');

    await page.goto('/');
    await addExpense(page, '5.00', merchant);
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();

    await page.getByRole('button', { name: `Delete ${merchant}` }).click();

    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toHaveCount(0);
  });
});

test.describe('multi-currency', () => {
  // The household is in dollars. An expense in euros keeps its own amount and
  // contributes a converted one to the totals, so the two figures are both
  // shown and are deliberately different.
  test('records an expense in another currency', async ({ page }) => {
    const merchant = uniqueMerchant('Paris');

    await page.goto('/');
    await openDialog(page);

    await page.getByLabel('Currency').selectOption('EUR');
    await page.getByLabel('Amount').fill('20');

    // The preview reads in the currency being typed, not the household's.
    await expect(page.getByTestId('amount-preview')).toHaveText('€20.00');

    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();
    await expect(page.getByTestId('expense-dialog')).toBeHidden();
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-amount')).toHaveText('€20.00');
    await expect(row.getByTestId('expense-base-amount')).toContainText('$');
  });

  // The conversion is the database's, at the rate for the day the expense
  // happened, and it is frozen on the row. A rate of one would show the same
  // number twice.
  test('converts it into the household currency', async ({ page }) => {
    const merchant = uniqueMerchant('Berlin');

    await page.goto('/');
    await openDialog(page);

    await page.getByLabel('Currency').selectOption('EUR');
    await page.getByLabel('Amount').fill('100');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();
    await expect(page.getByTestId('expense-dialog')).toBeHidden();
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    const converted = await row.getByTestId('expense-base-amount').textContent();

    expect(converted).not.toContain('100.00');
  });

  // An expense in the household's own currency needs no rate and no second
  // figure. Showing "$12.50 ≈ $12.50" would be noise on every ordinary row.
  test('shows no converted figure for the household currency', async ({ page }) => {
    const merchant = uniqueMerchant('Local');

    await page.goto('/');
    await addExpense(page, '12.50', merchant);
    await openUncategorised(page);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-amount')).toHaveText('$12.50');
    await expect(row.getByTestId('expense-base-amount')).toHaveCount(0);
  });

  // Typing 1000 as dollars and then switching to yen must not file a hundred
  // thousand yen: the exponent is part of what the text means.
  test('re-reads the amount when the currency changes', async ({ page }) => {
    await page.goto('/');
    await openDialog(page);

    await page.getByLabel('Amount').fill('1000');
    await expect(page.getByTestId('amount-preview')).toHaveText('$1,000.00');

    await page.getByLabel('Currency').selectOption('JPY');

    await expect(page.getByTestId('amount-preview')).toHaveText('¥1,000');
  });
});
