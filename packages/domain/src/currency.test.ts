import { describe, expect, it } from 'vitest';

import { isCurrencyCode, minorUnitsFor } from './currency';

describe('minorUnitsFor', () => {
  it('defaults to two decimal places', () => {
    expect(minorUnitsFor('USD')).toBe(2);
    expect(minorUnitsFor('EUR')).toBe(2);
    expect(minorUnitsFor('GBP')).toBe(2);
  });

  // The whole reason this function exists: dividing by 100 is wrong for a
  // meaningful slice of the world's currencies.
  it('knows the zero-decimal currencies', () => {
    expect(minorUnitsFor('JPY')).toBe(0);
    expect(minorUnitsFor('KRW')).toBe(0);
    expect(minorUnitsFor('VND')).toBe(0);
    expect(minorUnitsFor('CLP')).toBe(0);
  });

  it('knows the three-decimal currencies', () => {
    expect(minorUnitsFor('KWD')).toBe(3);
    expect(minorUnitsFor('BHD')).toBe(3);
    expect(minorUnitsFor('TND')).toBe(3);
  });

  it('knows the one-decimal currencies', () => {
    expect(minorUnitsFor('MGA')).toBe(1);
    expect(minorUnitsFor('MRU')).toBe(1);
  });

  it('accepts lowercase input', () => {
    expect(minorUnitsFor('jpy')).toBe(0);
  });

  it('rejects anything that is not a three-letter code', () => {
    expect(() => minorUnitsFor('US')).toThrow();
    expect(() => minorUnitsFor('USDD')).toThrow();
    expect(() => minorUnitsFor('12A')).toThrow();
  });
});

describe('isCurrencyCode', () => {
  it('accepts well-formed codes regardless of case', () => {
    expect(isCurrencyCode('USD')).toBe(true);
    expect(isCurrencyCode('jpy')).toBe(true);
  });

  it('rejects malformed codes', () => {
    expect(isCurrencyCode('US')).toBe(false);
    expect(isCurrencyCode('')).toBe(false);
    expect(isCurrencyCode('US1')).toBe(false);
  });
});
