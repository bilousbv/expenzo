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
  await openDialog(page);
  await page.getByLabel('Amount').fill(amount);
  await page.getByLabel('Merchant').fill(merchant);
  await page.getByRole('button', { name: 'Add expense' }).click();
  await expect(page.getByTestId('expense-dialog')).toBeHidden();
}

test.describe('expenses', () => {
  test('records an expense and shows it in the list', async ({ page }) => {
    const merchant = uniqueMerchant('Blue Bottle');

    await page.goto('/');
    await addExpense(page, '12.50', merchant);

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

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-author')).not.toBeEmpty();
  });

  test('narrows the list to one author and back', async ({ page }) => {
    const merchant = uniqueMerchant('Mine');

    await page.goto('/');
    await addExpense(page, '4.00', merchant);

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();

    // The signed-in member is the only one in this household, so filtering to
    // them keeps the row and "Everyone" brings the unfiltered list back.
    await page.getByRole('radiogroup', { name: 'Author' }).getByRole('radio').nth(1).click();
    await expect(row).toBeVisible();

    await page.getByTestId('author-all').click();
    await expect(row).toBeVisible();
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

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();

    await page.getByRole('button', { name: `Delete ${merchant}` }).click();

    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toHaveCount(0);
  });
});
