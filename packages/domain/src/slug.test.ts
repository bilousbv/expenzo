import { describe, expect, it } from 'vitest';

import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Dining Out')).toBe('dining-out');
  });

  it('strips accents rather than dropping the letter', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(slugify('Niños')).toBe('ninos');
  });

  it('collapses runs of separators into one hyphen', () => {
    expect(slugify('Home   &   Garden')).toBe('home-garden');
  });

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Travel--  ')).toBe('travel');
  });

  it('keeps digits', () => {
    expect(slugify('Car 2')).toBe('car-2');
  });

  it('closes up apostrophes instead of splitting the word', () => {
    expect(slugify("Sam's Club")).toBe('sams-club');
  });

  // The slug is a database key, not a display string. A name made entirely of
  // characters that cannot appear in one has to be rejected by the caller
  // rather than silently turned into something arbitrary.
  it('returns an empty string when nothing slug-safe survives', () => {
    expect(slugify('🎉🎉')).toBe('');
    expect(slugify('---')).toBe('');
  });

  it('caps the length so it cannot outgrow the column', () => {
    const slug = slugify('a'.repeat(200));

    expect(slug).toHaveLength(48);
  });

  it('does not leave a trailing hyphen after truncating', () => {
    const slug = slugify(`${'a'.repeat(47)} bcdef`);

    expect(slug.endsWith('-')).toBe(false);
  });

  it('is idempotent', () => {
    expect(slugify(slugify('Fees and Charges'))).toBe(slugify('Fees and Charges'));
  });
});
