import { expect, test as setup } from '@playwright/test';

import { ENGLISH_COOKIE } from './locale';

const STORAGE_STATE = 'e2e/.auth/user.json';

/** Mailpit, which `supabase start` exposes. Every local mail lands here. */
const MAIL_API = process.env.E2E_MAIL_API ?? 'http://127.0.0.1:54424/api/v1';

interface MailpitSummary {
  ID: string;
  To: { Address: string }[];
  Created: string;
}

async function newestMessageFor(email: string): Promise<string> {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAIL_API}/messages?limit=50`);

    if (response.ok) {
      const { messages = [] } = (await response.json()) as { messages?: MailpitSummary[] };
      const match = messages.find((message) =>
        message.To.some((recipient) => recipient.Address.toLowerCase() === email.toLowerCase()),
      );

      if (match) return match.ID;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `No sign-in email arrived for ${email} within 15s. Is \`pnpm db:start\` running?`,
  );
}

async function signInLinkFrom(messageId: string): Promise<string> {
  const response = await fetch(`${MAIL_API}/message/${messageId}`);
  if (!response.ok) throw new Error(`Could not read message ${messageId}`);

  const { HTML = '', Text = '' } = (await response.json()) as { HTML?: string; Text?: string };
  const body = `${HTML}\n${Text}`;

  // Supabase mails a /auth/v1/verify link that redirects on to our callback.
  const link = body.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/)?.[0];
  if (!link) throw new Error('The sign-in email contained no verification link.');

  return link.replaceAll('&amp;', '&');
}

/**
 * Signs the end-to-end account in through the genuine magic-link flow and saves
 * the cookies for every other spec to reuse.
 *
 * Deliberately the real path rather than a password shortcut: this way the
 * authentication people actually use is exercised on every run, and nothing has
 * to be enabled in config.toml purely for tests.
 *
 * The state is regenerated each run rather than cached, because access tokens
 * expire after an hour and a stale file fails in a way that looks like a broken
 * application.
 */
setup('authenticate', async ({ page }) => {
  // Before the first navigation, not just before the state is saved: this
  // setup drives the real sign-in UI with English selectors, and without the
  // cookie it would be reading a Ukrainian page. It is written out with the
  // rest of the state, so every signed-in spec inherits English too.
  await page.context().addCookies([ENGLISH_COOKIE]);

  const email = process.env.E2E_TEST_EMAIL;

  if (!email) {
    throw new Error(
      'End-to-end auth needs E2E_TEST_EMAIL. Copy apps/web/.env.example to .env.local and fill it from `pnpm db:status`.',
    );
  }

  // Clear the inbox so the link we pick up is unambiguously the one just sent.
  await fetch(`${MAIL_API}/messages`, { method: 'DELETE' }).catch(() => undefined);

  await page.goto('/login');

  // The magic link is now the secondary path — password sign-in is the default
  // — so it has to be revealed first. Locators are scoped to that section
  // because the page carries a second email field for the password form.
  await page.getByTestId('show-magic-link').click();

  const magicLink = page.getByTestId('magic-link');
  await magicLink.getByLabel(/email/i).fill(email);
  await magicLink.getByRole('button', { name: /send.*link/i }).click();

  await expect(page.getByTestId('login-sent')).toContainText(/check your email/i);

  const link = await signInLinkFrom(await newestMessageFor(email));
  await page.goto(link);

  // Landing on the app rather than being bounced back to /login is the proof
  // that the session cookies were written. `exact` matters: Playwright matches
  // accessible names by substring, and the login page heading is "Sign in to
  // Expenzo", so a loose match would pass on the very page we must not be on.
  // The session lives in cookies, so assert on those before anything visual:
  // if they are missing, every later "not logged in" failure traces back here.
  const cookies = await page.context().cookies();
  const authCookie = cookies.find((cookie) => cookie.name.endsWith('-auth-token'));
  expect(
    authCookie,
    `no Supabase auth cookie was kept. Browser held: ${cookies.map((c) => c.name).join(', ') || 'nothing'}`,
  ).toBeDefined();

  const landed = new URL(page.url());
  expect(landed.pathname, `bounced back to login: ${landed.search || 'no error given'}`).not.toBe(
    '/login',
  );

  // The app name is a link in the site header now rather than a heading inside
  // the dashboard panel, so this looks for the header itself.
  await expect(page.getByTestId('go-home')).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
