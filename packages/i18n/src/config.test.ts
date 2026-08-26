import { describe, expect, it } from 'vitest';

import { defaultLocale, intlTagFor, isLocale, LOCALE_LABEL, locales } from './config';

describe('locales', () => {
  it('offers Ukrainian and English', () => {
    expect([...locales].sort()).toEqual(['en', 'uk']);
  });

  // The product decision, not an accident of ordering: a household that has
  // chosen nothing gets Ukrainian.
  it('defaults to Ukrainian', () => {
    expect(defaultLocale).toBe('uk');
  });

  // Endonyms. Someone who cannot read the current language still has to be able
  // to find their own in the switcher, and "Ukrainian" is no help to them.
  it('names each language in that language', () => {
    expect(LOCALE_LABEL.uk).toBe('Українська');
    expect(LOCALE_LABEL.en).toBe('English');
  });
});

describe('isLocale', () => {
  it('accepts the locales we ship', () => {
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('en')).toBe(true);
  });

  // Cookies are user-editable, so this guards a value that arrives from
  // outside. Anything unrecognised has to fall back rather than be trusted.
  it('rejects anything else', () => {
    expect(isLocale('ru')).toBe(false);
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale('UK')).toBe(false);
  });
});

describe('intlTagFor', () => {
  // Intl needs a region to pick separators and currency placement: uk-UA groups
  // with a space and writes 1 234,56, which bare "uk" does not guarantee.
  it('maps each locale to a full BCP 47 tag', () => {
    expect(intlTagFor('uk')).toBe('uk-UA');
    expect(intlTagFor('en')).toBe('en-US');
  });
});
