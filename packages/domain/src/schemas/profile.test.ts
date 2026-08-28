import { describe, expect, it } from 'vitest';

import { personDisplayName, personNameSchema, updateProfileInput } from './profile';

describe('personNameSchema', () => {
  it('accepts an ordinary name', () => {
    expect(personNameSchema.parse('Ana')).toBe('Ana');
  });

  it('trims, so a stray space does not become part of the name', () => {
    expect(personNameSchema.parse('  Ana  ')).toBe('Ana');
  });

  // Names are not ASCII. A rule tight enough to be worth having would reject
  // real people, so the only limits are length and emptiness.
  it('accepts a name in any script', () => {
    expect(personNameSchema.parse('Ірина')).toBe('Ірина');
    expect(personNameSchema.parse("O'Brien-Smith")).toBe("O'Brien-Smith");
  });

  it('rejects a name long enough to be a paste accident', () => {
    expect(personNameSchema.safeParse('a'.repeat(81)).success).toBe(false);
  });

  it('rejects a blank one', () => {
    expect(personNameSchema.safeParse('   ').success).toBe(false);
  });
});

describe('personDisplayName', () => {
  it('joins the two names', () => {
    expect(personDisplayName({ firstName: 'Ana', lastName: 'Petrenko' })).toBe('Ana Petrenko');
  });

  it('uses whichever one is present', () => {
    expect(personDisplayName({ firstName: 'Ana' })).toBe('Ana');
    expect(personDisplayName({ lastName: 'Petrenko' })).toBe('Petrenko');
  });

  /*
   * Signing in with a magic link never asks for a name, so the trigger's
   * fallback — the local part of the address — is what those accounts have.
   * It is a real name for display purposes and must not be discarded.
   */
  it('falls back to the name the signup trigger derived', () => {
    expect(personDisplayName({ displayName: 'ana' })).toBe('ana');
  });

  it('prefers the real names over that fallback', () => {
    expect(personDisplayName({ firstName: 'Ana', displayName: 'ana.p' })).toBe('Ana');
  });

  // The caller decides what to render instead, because only it knows the
  // language: this package holds no prose.
  it('returns null when there is nothing to show', () => {
    expect(personDisplayName({})).toBeNull();
    expect(personDisplayName({ firstName: null, lastName: null, displayName: null })).toBeNull();
  });

  it('ignores a blank stored value rather than rendering a gap', () => {
    expect(personDisplayName({ firstName: '  ', lastName: 'Petrenko' })).toBe('Petrenko');
  });
});

describe('updateProfileInput', () => {
  it('accepts names and a display currency', () => {
    expect(
      updateProfileInput.parse({ firstName: 'Ana', lastName: 'Petrenko', displayCurrency: 'UAH' }),
    ).toEqual({ firstName: 'Ana', lastName: 'Petrenko', displayCurrency: 'UAH' });
  });

  /*
   * Null is how a member says "show me the household's own currency", and it
   * is not the same as omitting the field, which changes nothing. Collapsing
   * the two would make clearing a display currency impossible.
   */
  it('keeps null distinct from absent', () => {
    expect(updateProfileInput.parse({ displayCurrency: null })).toEqual({ displayCurrency: null });
    expect(updateProfileInput.parse({})).toEqual({});
  });

  it('turns a cleared name into null rather than an empty string', () => {
    expect(updateProfileInput.parse({ firstName: '' })).toEqual({ firstName: null });
  });

  it('rejects a currency that is not an ISO code', () => {
    expect(updateProfileInput.safeParse({ displayCurrency: 'uah' }).success).toBe(false);
    expect(updateProfileInput.safeParse({ displayCurrency: 'HRYVNIA' }).success).toBe(false);
  });
});
