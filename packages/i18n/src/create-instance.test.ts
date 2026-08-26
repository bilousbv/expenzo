import { describe, expect, it } from 'vitest';

import { createI18n } from './create-instance';

describe('createI18n', () => {
  it('translates in the locale it was created for', () => {
    const uk = createI18n('uk');
    const en = createI18n('en');

    expect(uk.t('auth.signIn')).toBe('Увійти');
    expect(en.t('auth.signIn')).toBe('Sign in');
  });

  it('reports the locale it is serving', () => {
    expect(createI18n('uk').language).toBe('uk');
  });

  it('interpolates values rather than printing the placeholder', () => {
    const en = createI18n('en');

    expect(en.t('validation.password.tooShort', { min: 8 })).toContain('8');
    expect(en.t('validation.password.tooShort', { min: 8 })).not.toContain('{{');
  });

  /**
   * Ukrainian has three plural forms where English has two: одна витрата, дві
   * витрати, п'ять витрат. Getting this wrong is the most visible way a
   * translation reads as machine-made, and it is why the catalogue carries
   * `_one` / `_few` / `_many` rather than a single string with a bare count.
   */
  it('picks the right Ukrainian plural form for each count', () => {
    const uk = createI18n('uk');

    expect(uk.t('expenses.count', { count: 1 })).toBe('1 витрата');
    expect(uk.t('expenses.count', { count: 3 })).toBe('3 витрати');
    expect(uk.t('expenses.count', { count: 5 })).toBe('5 витрат');
    expect(uk.t('expenses.count', { count: 21 })).toBe('21 витрата');
  });

  it('still pluralises English with its two forms', () => {
    const en = createI18n('en');

    expect(en.t('expenses.count', { count: 1 })).toBe('1 expense');
    expect(en.t('expenses.count', { count: 5 })).toBe('5 expenses');
  });

  // An unknown key must be loud rather than blank. A missing string that
  // renders as empty space is a bug nobody reports.
  it('returns the key itself when there is no such string', () => {
    const uk = createI18n('uk');

    expect(uk.t('nothing.like.this')).toBe('nothing.like.this');
  });
});
