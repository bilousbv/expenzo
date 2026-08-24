import { describe, expect, it } from 'vitest';

import { addMoney, compareMoney, isZeroMoney, money, negateMoney, sumMoney } from './money';

describe('money', () => {
  it('builds a value from integer minor units', () => {
    expect(money(1250, 'USD')).toEqual({ amountMinor: 1250, currency: 'USD' });
  });

  it('upper-cases the currency so equality is never case-dependent', () => {
    expect(money(1250, 'usd').currency).toBe('USD');
  });

  // Floats are the classic money bug. Reject them at the boundary rather than
  // rounding silently somewhere downstream.
  it('rejects non-integer amounts', () => {
    expect(() => money(12.5, 'USD')).toThrow(/integer/i);
  });

  it('rejects a malformed currency', () => {
    expect(() => money(100, 'US')).toThrow();
  });

  it('allows zero and negative amounts', () => {
    expect(money(0, 'USD').amountMinor).toBe(0);
    expect(money(-500, 'USD').amountMinor).toBe(-500);
  });
});

describe('addMoney', () => {
  it('adds two amounts in the same currency', () => {
    expect(addMoney(money(1250, 'USD'), money(750, 'USD'))).toEqual(money(2000, 'USD'));
  });

  it('refuses to add across currencies', () => {
    expect(() => addMoney(money(1000, 'USD'), money(1000, 'EUR'))).toThrow(/currency/i);
  });
});

describe('sumMoney', () => {
  it('sums a list', () => {
    expect(sumMoney([money(100, 'USD'), money(250, 'USD')], 'USD')).toEqual(money(350, 'USD'));
  });

  // An empty list still has to produce a typed zero, which is why the currency
  // is an explicit argument rather than inferred from the first element.
  it('returns zero in the given currency for an empty list', () => {
    expect(sumMoney([], 'JPY')).toEqual(money(0, 'JPY'));
  });

  it('refuses to sum mixed currencies', () => {
    expect(() => sumMoney([money(100, 'USD'), money(100, 'EUR')], 'USD')).toThrow(/currency/i);
  });
});

describe('compareMoney', () => {
  it('orders amounts', () => {
    expect(compareMoney(money(100, 'USD'), money(200, 'USD'))).toBe(-1);
    expect(compareMoney(money(200, 'USD'), money(100, 'USD'))).toBe(1);
    expect(compareMoney(money(100, 'USD'), money(100, 'USD'))).toBe(0);
  });

  it('refuses to compare across currencies', () => {
    expect(() => compareMoney(money(100, 'USD'), money(100, 'EUR'))).toThrow(/currency/i);
  });
});

describe('isZeroMoney and negateMoney', () => {
  it('detects zero', () => {
    expect(isZeroMoney(money(0, 'USD'))).toBe(true);
    expect(isZeroMoney(money(1, 'USD'))).toBe(false);
  });

  it('negates', () => {
    expect(negateMoney(money(1250, 'USD'))).toEqual(money(-1250, 'USD'));
  });
});
