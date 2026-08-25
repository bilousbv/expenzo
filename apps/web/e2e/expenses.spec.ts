import { expect, test } from '@playwright/test';

/** Unique per run: expenses accumulate, and every spec shares one household. */
function uniqueMerchant(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

test.describe('expenses', () => {
  test('records an expense and shows it in the list', async ({ page }) => {
    const merchant = uniqueMerchant('Blue Bottle');

    await page.goto('/');

    await page.getByLabel('Amount').fill('12.50');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

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

    await page.getByLabel('Amount').fill('1,234');

    await expect(page.getByTestId('amount-preview')).toHaveText('$1,234.00');
  });

  test('accepts a decimal comma', async ({ page }) => {
    const merchant = uniqueMerchant('Comma');

    await page.goto('/');

    await page.getByLabel('Amount').fill('7,25');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row.getByTestId('expense-amount')).toHaveText('$7.25');
  });

  test('files an expense under a category', async ({ page }) => {
    const merchant = uniqueMerchant('Groceries run');

    await page.goto('/');

    await page.getByLabel('Amount').fill('30.00');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('radio', { name: 'Groceries' }).click();
    await page.getByRole('button', { name: 'Add expense' }).click();

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toContainText('Groceries');
  });

  // Every member sees every expense now, so the row carries its author instead
  // of a privacy badge. There is no way to enter one that anybody is hidden
  // from — which is the whole point of the change.
  test('attributes each expense to its author', async ({ page }) => {
    const merchant = uniqueMerchant('Attributed');

    await page.goto('/');

    await page.getByLabel('Amount').fill('9.99');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();
    await expect(row.getByTestId('expense-author')).not.toBeEmpty();

    // The form no longer offers a privacy control at all.
    await expect(page.getByLabel('Personal')).toHaveCount(0);
  });

  test('narrows the list to one author and back', async ({ page }) => {
    const merchant = uniqueMerchant('Mine');

    await page.goto('/');

    await page.getByLabel('Amount').fill('4.00');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();

    // The signed-in member is the only one in this household, so filtering to
    // them keeps the row and "Everyone" brings the unfiltered list back.
    const authorButtons = page.getByRole('radio');
    await authorButtons.nth(1).click();
    await expect(row).toBeVisible();

    await page.getByTestId('author-all').click();
    await expect(row).toBeVisible();
  });

  test('refuses an amount that is not a number', async ({ page }) => {
    await page.goto('/');

    await page.getByLabel('Amount').fill('not money');
    await page.getByRole('button', { name: 'Add expense' }).click();

    await expect(page.getByTestId('expense-error')).toBeVisible();
  });

  // Soft delete: the row leaves the list, and the audit trigger keeps a record
  // of who removed it.
  test('removes an expense from the list', async ({ page }) => {
    const merchant = uniqueMerchant('Delete me');

    await page.goto('/');

    await page.getByLabel('Amount').fill('5.00');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

    const row = page.getByTestId('expense-row').filter({ hasText: merchant });
    await expect(row).toBeVisible();

    await page.getByRole('button', { name: `Delete ${merchant}` }).click();

    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toHaveCount(0);
  });

  test('clears the amount but keeps the merchant, ready for the next one', async ({ page }) => {
    const merchant = uniqueMerchant('Repeat');

    await page.goto('/');

    await page.getByLabel('Amount').fill('3.50');
    await page.getByLabel('Merchant').fill(merchant);
    await page.getByRole('button', { name: 'Add expense' }).click();

    await expect(page.getByTestId('expense-row').filter({ hasText: merchant })).toBeVisible();
    await expect(page.getByLabel('Amount')).toHaveValue('');
    await expect(page.getByLabel('Merchant')).toHaveValue(merchant);
  });
});
