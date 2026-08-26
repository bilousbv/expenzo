import { LOCALE_COOKIE } from '@expenzo/i18n';
import type { Cookie } from '@playwright/test';

/**
 * The app defaults to Ukrainian, and every assertion in these specs is written
 * against the English text. Rather than translate ninety-odd selectors — which
 * would need doing again for the next language — the suite pins itself to
 * English by carrying the locale cookie, and the Ukrainian default gets a spec
 * of its own where it is the actual subject.
 *
 * `127.0.0.1` rather than localhost because that is what `baseURL` uses, and a
 * cookie set for one is not sent to the other.
 */
export const ENGLISH_COOKIE: Cookie = {
  name: LOCALE_COOKIE,
  value: 'en',
  domain: '127.0.0.1',
  path: '/',
  // A session cookie. It only has to outlive the test that is using it.
  expires: -1,
  httpOnly: false,
  secure: false,
  sameSite: 'Lax',
};

/** For the specs that deliberately run signed out but still read English. */
export const SIGNED_OUT_IN_ENGLISH = {
  cookies: [ENGLISH_COOKIE],
  origins: [],
};
