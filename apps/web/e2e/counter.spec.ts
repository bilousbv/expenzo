import { expect, test } from '@playwright/test';

test.describe('expense counter', () => {
  test('adds and resets the total', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Expenzo' })).toBeVisible();

    // Scoped to the total itself: the amount also appears in the button label,
    // so a bare text lookup matches two elements.
    const total = page.getByTestId('total-spent');
    await expect(total).toHaveText('$0.00');

    const add = page.getByRole('button', { name: 'Add $12.50' });

    await add.click();
    await expect(total).toHaveText('$12.50');

    await add.click();
    await expect(total).toHaveText('$25.00');

    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(total).toHaveText('$0.00');
  });
});
