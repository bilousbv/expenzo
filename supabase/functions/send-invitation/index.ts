// Issuing an invitation and putting the link in an email.
//
// The token used to be returned to the browser and rendered on the settings
// screen for someone to copy. That made the invitation only as private as the
// screen it was on, and put the work of delivering it on the person inviting.
// Here the token never leaves the server: this function asks the database for
// one, sends it, and answers with nothing but "sent".
//
// An edge function rather than a route in apps/web, because both platforms
// invite. A Next route would make the phone talk to the web app to reach the
// database it is already connected to.

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

type InvitableRole = 'adult' | 'child';

interface InviteRequest {
  email?: unknown;
  role?: unknown;
  locale?: unknown;
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/**
 * The email copy, in both languages.
 *
 * The rest of the app's text lives in packages/i18n, and this is the one place
 * that cannot read it: Deno resolves no workspace package, and the alternative
 * — letting the client post the subject and body it wants sent — would turn an
 * authenticated member into an open relay for arbitrary text.
 *
 * Ukrainian first, as everywhere else in the product.
 */
const COPY = {
  uk: {
    subject: (household: string) => `Вас запрошено до «${household}» в Expenzo`,
    heading: (household: string) => `Вас запрошено до «${household}»`,
    role: {
      adult: 'Ви зможете додавати витрати й керувати спільним бюджетом.',
      child: 'Ви зможете додавати власні витрати й бачити спільний бюджет.',
    },
    action: 'Приєднатися до домогосподарства',
    fallback: 'Якщо кнопка не працює, відкрийте це посилання:',
    expiry: 'Посилання діє 14 днів і спрацьовує один раз.',
  },
  en: {
    subject: (household: string) => `You have been invited to ${household} on Expenzo`,
    heading: (household: string) => `You have been invited to ${household}`,
    role: {
      adult: 'You will be able to record expenses and manage the shared budget.',
      child: 'You will be able to record your own expenses and see the shared budget.',
    },
    action: 'Join the household',
    fallback: 'If the button does not work, open this link:',
    expiry: 'The link works once and expires after 14 days.',
  },
} as const;

type Locale = keyof typeof COPY;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * A Subject line a mail server will accept.
 *
 * denomailer encodes any non-ASCII header itself, as an RFC 2047
 * quoted-printable word — and its encoder inserts a soft line break (`=\r\n`)
 * every 74 characters. That is correct inside a message body and invalid
 * inside a header: the second line is not a continuation, so the server reads
 * it as a new and malformed header and refuses the whole message with
 * `451 4.3.5 Unable to process mail`, leaving the invitation row written and
 * no email sent.
 *
 * Quoted-printable spends six characters on every Cyrillic letter, so a
 * Ukrainian subject passes 74 immediately. Ukrainian is the app's default, so
 * this was the ordinary path; English is all ASCII, never encodes and never
 * wraps, which is exactly why the half of it covered by tests looked healthy.
 *
 * So the word is built here, in base64, which stays well under the limit — and
 * handed over in a form denomailer will leave alone. It encodes a header when
 * it finds a non-ASCII character *or* a leading `=?`, and one leading space
 * defeats the second test while the first no longer applies. Whitespace after
 * the colon is not part of a header's value, so every parser drops it.
 */
function encodeSubject(value: string): string {
  if (!/[^ -~]/.test(value)) return value;

  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return ` =?UTF-8?B?${btoa(binary)}?=`;
}

function body(locale: Locale, household: string, role: InvitableRole, link: string) {
  const copy = COPY[locale];

  const text = [copy.heading(household), '', copy.role[role], '', link, '', copy.expiry].join('\n');

  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
  <h1 style="font-size:20px">${escapeHtml(copy.heading(household))}</h1>
  <p>${escapeHtml(copy.role[role])}</p>
  <p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#111;color:#fff;text-decoration:none">${escapeHtml(copy.action)}</a></p>
  <p style="color:#666;font-size:13px">${escapeHtml(copy.fallback)}<br><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
  <p style="color:#666;font-size:13px">${escapeHtml(copy.expiry)}</p>
</div>`;

  return { text, html, subject: copy.subject(household) };
}

function fail(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return fail('Use POST', 405);

  // Forwarded rather than swapped for the service role: create_household_invitation
  // decides whether this caller may invite at all, and it can only do that if it
  // still knows who is asking.
  const authorization = request.headers.get('Authorization');
  if (!authorization) return fail('Not signed in', 401);

  let payload: InviteRequest;
  try {
    payload = (await request.json()) as InviteRequest;
  } catch {
    return fail('Expected a JSON body', 400);
  }

  const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
  const role: InvitableRole = payload.role === 'child' ? 'child' : 'adult';
  const locale: Locale = payload.locale === 'en' ? 'en' : 'uk';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address', 400);

  const db = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  );

  // The household name is for the email, and reading it here rather than
  // trusting a name posted by the client is what stops an invitation claiming
  // to come from somewhere it does not.
  const { data: household } = await db.from('households').select('name').maybeSingle();

  const { data: token, error } = await db.rpc('create_household_invitation', {
    invitee_email: email,
    invitee_role: role,
  });

  // A refusal here is the database's permission check, not a server fault.
  if (error) return fail(error.message, 403);
  if (!token) return fail('The invitation could not be created', 500);

  const appUrl = Deno.env.get('INVITE_APP_URL') ?? '';
  const link = `${appUrl.replace(/\/$/, '')}/invite/${token}`;
  const mail = body(locale, household?.name ?? 'Expenzo', role, link);

  const tls = Deno.env.get('SMTP_TLS') === 'true';
  const user = Deno.env.get('SMTP_USER') ?? '';

  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get('SMTP_HOST') ?? '',
      port: Number(Deno.env.get('SMTP_PORT') ?? '587'),
      tls,
      // Omitted entirely rather than passed as undefined: denomailer refuses to
      // send credentials over a plaintext connection, and the local mail
      // catcher wants none.
      ...(user ? { auth: { username: user, password: Deno.env.get('SMTP_PASS') ?? '' } } : {}),
    },
    // The local catcher speaks plaintext on the compose network. Anything with
    // real credentials sets SMTP_TLS, and then this is off.
    debug: { allowUnsecure: !tls },
  });

  try {
    await client.send({
      from: Deno.env.get('INVITE_FROM') ?? 'invites@expenzo.app',
      to: email,
      subject: encodeSubject(mail.subject),
      content: mail.text,
      html: mail.html,
    });
    await client.close();
  } catch (cause) {
    // The invitation row exists at this point. Saying so is better than a bare
    // failure: the address can be re-invited, which supersedes this token.
    return fail(`The invitation was created but could not be emailed: ${cause}`, 502);
  }

  // Deliberately not the token. The whole point of the change is that it exists
  // in the email and nowhere else.
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
});
