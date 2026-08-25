import { expect, test } from '@playwright/test';

/** Unique per run: categories persist, and the slug is unique per household. */
function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

test.describe('categories', () => {
  test('shows the seeded taxonomy every household starts with', async ({ page }) => {
    await page.goto('/settings/categories');

    // exact, because "Your categories" is also a heading.
    await expect(page.getByRole('heading', { name: 'Categories', exact: true })).toBeVisible();

    // Seeded by a migration rather than seed.sql, so production has them too.
    await expect(page.getByTestId('system-category').first()).toBeVisible();
    await expect(
      page.getByTestId('system-category').filter({ hasText: 'Groceries' }),
    ).toBeVisible();
  });

  test('adds a custom category and shows it straight away', async ({ page }) => {
    const name = uniqueName('Coffee');

    await page.goto('/settings/categories');
    await expect(
      page.getByTestId('no-custom-categories').or(page.getByTestId('custom-category').first()),
    ).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByRole('radio', { name: 'Orange' }).click();
    await page.getByRole('button', { name: 'Add category' }).click();

    // Proves the invalidation reaches the list, not just that the insert
    // returned 200.
    await expect(page.getByTestId('custom-category').filter({ hasText: name })).toBeVisible();

    // And that it survives a reload, which a purely optimistic update would not.
    await page.reload();
    await expect(page.getByTestId('custom-category').filter({ hasText: name })).toBeVisible();
  });

  test('refuses a duplicate name with a sentence rather than a constraint', async ({ page }) => {
    const name = uniqueName('Duplicate');

    await page.goto('/settings/categories');

    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Add category' }).click();
    await expect(page.getByTestId('custom-category').filter({ hasText: name })).toBeVisible();

    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(page.getByTestId('category-error')).toContainText(/already exists/i);
  });

  test('archives a category, taking it out of the list without deleting history', async ({
    page,
  }) => {
    const name = uniqueName('Archive me');

    await page.goto('/settings/categories');

    await page.getByLabel('Name').fill(name);
    await page.getByRole('button', { name: 'Add category' }).click();

    const chip = page.getByTestId('custom-category').filter({ hasText: name });
    await expect(chip).toBeVisible();

    await page.getByRole('button', { name: `Archive ${name}` }).click();

    await expect(chip).toBeHidden();
  });

  test('reaches the screen from household settings', async ({ page }) => {
    await page.goto('/settings/household');

    await page.getByRole('link', { name: 'Manage categories' }).click();

    await expect(page).toHaveURL(/\/settings\/categories$/);
  });
});
