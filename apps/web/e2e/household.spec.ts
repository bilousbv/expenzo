import { expect, test, type Page } from '@playwright/test';

import { ENGLISH_COOKIE } from './locale';

/** Mailpit, which `supabase start` exposes. Every local mail lands here. */
const MAIL_API = process.env.E2E_MAIL_API ?? 'http://127.0.0.1:54424/api/v1';

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Subject: string;
}

/**
 * The invitation token, read out of the inbox it was actually sent to.
 *
 * It is on no screen any more, so this is the only way to get one — which is
 * the point of the change, and worth asserting rather than assuming.
 */
async function invitationTokenFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAIL_API}/messages?limit=50`);

    if (response.ok) {
      const { messages = [] } = (await response.json()) as { messages?: MailpitSummary[] };
      const match = messages.find((message) =>
        message.To.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
      );

      if (match) {
        const detail = await fetch(`${MAIL_API}/message/${match.ID}`);
        const { HTML = '', Text = '' } = (await detail.json()) as { HTML?: string; Text?: string };
        // The token, not the whole link: the function builds that from
        // INVITE_APP_URL, which points at the dev server rather than at the
        // port Playwright serves its own build on.
        const token = `${HTML}\n${Text}`.match(/\/invite\/([A-Za-z0-9_-]+)/)?.[1];

        if (token) return token;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`No invitation email arrived for ${email} within 15s.`);
}

async function invite(page: Page, email: string, role: 'adult' | 'child' = 'adult') {
  await page.getByTestId('open-invite-dialog').click();

  // Scoped to the dialog: the button that opened it is also called Invite,
  // which is right on screen and ambiguous to a locator.
  const dialog = page.getByTestId('invite-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel(/email/i).fill(email);
  if (role === 'child') await dialog.getByTestId('invite-role-child').check();

  await dialog.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(dialog.getByTestId('invite-sent')).toContainText(email);
}

test.describe('household', () => {
  test('lists the signed-in member', async ({ page }) => {
    await page.goto('/settings/household');

    await expect(page.getByRole('heading', { name: /members/i })).toBeVisible();
    await expect(page.getByTestId('member-name').first()).toBeVisible();
  });

  // The form used to sit in a card of its own on this screen. Adding somebody
  // to the household happens a handful of times ever.
  test('invites from a dialog, and never shows the token', async ({ page }) => {
    const email = `invited-${Date.now()}@expenzo.test`;

    await page.goto('/settings/household');
    await invite(page, email);

    await expect(page.getByTestId('invite-link')).toHaveCount(0);
  });

  test('emails the link rather than putting it on screen', async ({ page }) => {
    const email = `mailed-${Date.now()}@expenzo.test`;

    await page.goto('/settings/household');
    await invite(page, email);

    // The token is on no screen any more, so the inbox is the only place it
    // can be got from — which is the point of the change.
    expect((await invitationTokenFor(email)).length).toBeGreaterThan(31);
  });

  /*
   * The rest of this suite is pinned to English, so every invitation it sends
   * carries an all-ASCII subject line. Ukrainian is the app's default and its
   * subject is not ASCII, which is a different path through the mail encoder
   * entirely — and the one that was rejected outright, taking the whole send
   * with it while the English half looked perfectly healthy.
   */
  test('emails an invitation from the Ukrainian app too', async ({ page, context }) => {
    const email = `ukrainian-${Date.now()}@expenzo.test`;

    // Only the locale cookie is replaced, never cleared: clearing would take
    // the session with it and sign the household's owner out.
    await context.addCookies([{ ...ENGLISH_COOKIE, value: 'uk' }]);
    await page.goto('/settings/household');

    await page.getByTestId('open-invite-dialog').click();
    const dialog = page.getByTestId('invite-dialog');
    await dialog.getByRole('textbox').fill(email);
    await dialog.getByRole('button', { name: 'Запросити', exact: true }).click();
    await expect(dialog.getByTestId('invite-sent')).toContainText(email);

    expect((await invitationTokenFor(email)).length).toBeGreaterThan(31);
  });

  test('records what the invitee will join as', async ({ page }) => {
    const email = `kid-${Date.now()}@expenzo.test`;

    await page.goto('/settings/household');
    await invite(page, email, 'child');

    await page.reload();
    const row = page
      .locator('li')
      .filter({ has: page.getByTestId('invitation-email').filter({ hasText: email }) });

    await expect(row.getByTestId('invitation-role')).toHaveText(/child/i);
  });

  test('withdraws an invitation', async ({ page }) => {
    const email = `withdrawn-${Date.now()}@expenzo.test`;

    await page.goto('/settings/household');
    await invite(page, email);
    await page.reload();

    const row = page
      .locator('li')
      .filter({ has: page.getByTestId('invitation-email').filter({ hasText: email }) });

    await row.getByRole('button', { name: /cancel/i }).click();

    await expect(page.getByTestId('invitation-email').filter({ hasText: email })).toHaveCount(0);
  });

  // The owner's membership is what households.owner_id points at, and the
  // e2e account owns its household — so this row is the one that must carry
  // no controls at all.
  test('offers no way to remove the owner', async ({ page }) => {
    await page.goto('/settings/household');

    await expect(page.getByTestId('member-name').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^remove$/i })).toHaveCount(0);
  });

  test('reports a token that is not valid', async ({ page }) => {
    await page.goto('/invite/definitely-not-a-real-token');

    await expect(page.getByText(/did not work/i)).toBeVisible();
  });

  // The invitation route used to sit inside the (app) group, whose guard sent
  // an unauthenticated visitor to /login — without the token, to a page that
  // could not bring them back. This is that visitor.
  test('sends a signed-out visitor to register with the address filled in', async ({ browser }) => {
    const owner = await browser.newPage();
    const email = `newcomer-${Date.now()}@expenzo.test`;

    await owner.goto('/settings/household');
    await invite(owner, email);
    const token = await invitationTokenFor(email);
    await owner.close();

    // A fresh context, so there is no session and no locale cookie.
    const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    await visitor.goto(`/invite/${token}`);

    await visitor.waitForURL(/\/register\?/);
    await expect(visitor.locator('input[name="email"]')).toHaveValue(email);
    await visitor.close();
  });
});
