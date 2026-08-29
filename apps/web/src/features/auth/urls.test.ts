import { describe, expect, it } from 'vitest';

import { callbackUrl, magicLinkHref } from './urls';

describe('callbackUrl', () => {
  it('sends the browser back to where it was heading', () => {
    expect(callbackUrl('http://localhost:3000', '/settings/profile')).toBe(
      'http://localhost:3000/auth/callback?next=%2Fsettings%2Fprofile',
    );
  });

  /*
   * Built from the origin the browser actually used rather than a configured
   * one: localhost and 127.0.0.1 are different origins to GoTrue, and an
   * unlisted redirect is not an error — it silently falls back to site_url.
   */
  it('keeps whichever origin the browser is on', () => {
    expect(callbackUrl('http://127.0.0.1:3000', '/')).toBe(
      'http://127.0.0.1:3000/auth/callback?next=%2F',
    );
  });
});

describe('magicLinkHref', () => {
  /*
   * The destination has to survive the trip to the magic-link page, or asking
   * for a link from a guarded URL drops you on the dashboard instead of where
   * you were going.
   */
  it('carries the destination across to the magic-link page', () => {
    expect(magicLinkHref('/settings/profile')).toBe('/magic-link?next=%2Fsettings%2Fprofile');
  });

  it('leaves the parameter off when there is nowhere in particular to go', () => {
    expect(magicLinkHref('/')).toBe('/magic-link');
  });
});
