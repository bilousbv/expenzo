import { expect, test } from '@playwright/test';

test.describe('household', () => {
  test('lists the signed-in member and offers an invite link', async ({ page }) => {
    await page.goto('/settings/household');

    await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();
    await expect(page.getByTestId('member-name').first()).toBeVisible();

    await page.getByLabel(/email/i).fill('someone@example.com');
    await page.getByRole('button', { name: 'Invite', exact: true }).click();

    const link = page.getByTestId('invite-link');
    await expect(link).toBeVisible();
    await expect(link).toContainText('/invite/');
  });

  test('reports a token that is not valid', async ({ page }) => {
    await page.goto('/invite/definitely-not-a-real-token');

    await expect(page.getByTestId('invite-error')).toBeVisible();
  });
});
