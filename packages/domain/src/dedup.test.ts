import { describe, expect, it } from 'vitest';

import { matchScore, normalizeMerchant } from './dedup';

describe('normalizeMerchant', () => {
  // Table-driven over real card-statement strings, because this function is
  // load-bearing for every deduplication decision in the product.
  const cases: [input: string, expected: string][] = [
    ['Blue Bottle Coffee', 'blue bottle coffee'],
    ['BLUE BOTTLE COFFEE', 'blue bottle coffee'],
    ['  Blue   Bottle  Coffee  ', 'blue bottle coffee'],

    // Card-processor prefixes
    ['SQ *BLUE BOTTLE COFFE', 'blue bottle coffe'],
    ['TST* JOES PIZZA', 'joes pizza'],
    ['PAYPAL *SPOTIFYUSA', 'spotifyusa'],
    ['SP * ALLBIRDS', 'allbirds'],
    ['IN *ACME SERVICES', 'acme services'],
    ['POS PURCHASE TESCO', 'tesco'],

    // Trailing store numbers, terminal ids and locations
    ['WALMART #1234', 'walmart'],
    ['SHELL OIL 57445234567', 'shell oil'],
    ['STARBUCKS STORE 08321', 'starbucks'],
    ['TESCO STORES 3456 LONDON GB', 'tesco stores london gb'],

    // Legal suffixes
    ['Acme Widgets Inc.', 'acme widgets'],
    ['Acme Widgets, LLC', 'acme widgets'],
    ['Acme Widgets Ltd', 'acme widgets'],
    ['Acme Widgets GmbH', 'acme widgets'],
    ['Acme Widgets S.A.', 'acme widgets'],

    // Diacritics
    ['Café Münchën', 'cafe munchen'],
    ['CARREFOUR CITÉ', 'carrefour cite'],

    // Punctuation
    ['AT&T Mobility', 'at t mobility'],
    ["MCDONALD'S", 'mcdonalds'],

    // Degenerate input
    ['', ''],
    ['   ', ''],
  ];

  it.each(cases)('normalizes %j to %j', (input, expected) => {
    expect(normalizeMerchant(input)).toBe(expected);
  });

  it('is idempotent', () => {
    const once = normalizeMerchant('SQ *BLUE BOTTLE COFFE #221');
    expect(normalizeMerchant(once)).toBe(once);
  });
});

describe('matchScore', () => {
  const base = {
    merchant: 'Blue Bottle Coffee',
    amountMinor: 1250,
    currency: 'USD',
    occurredOn: '2026-03-15',
    categoryId: 'cat-1',
  };

  it('scores an identical purchase at or above the auto-merge threshold', () => {
    expect(matchScore(base, { ...base })).toBeGreaterThanOrEqual(0.9);
  });

  it('still scores highly when only the merchant string differs cosmetically', () => {
    expect(
      matchScore(base, { ...base, merchant: 'SQ *BLUE BOTTLE COFFEE' }),
    ).toBeGreaterThanOrEqual(0.9);
  });

  it('lands in the review band when the amount is close but not equal', () => {
    // A 2% difference stands in for a tip or a rounding discrepancy.
    const score = matchScore(base, { ...base, amountMinor: 1270 });
    expect(score).toBeGreaterThanOrEqual(0.55);
    expect(score).toBeLessThan(0.9);
  });

  it('scores a different merchant below the review threshold', () => {
    expect(matchScore(base, { ...base, merchant: 'Shell Oil' })).toBeLessThan(0.55);
  });

  it('scores across currencies as no match at all', () => {
    expect(matchScore(base, { ...base, currency: 'EUR' })).toBeLessThan(0.55);
  });

  it('decays with date distance', () => {
    const sameDay = matchScore(base, { ...base });
    const oneDay = matchScore(base, { ...base, occurredOn: '2026-03-16' });
    const threeDays = matchScore(base, { ...base, occurredOn: '2026-03-18' });

    expect(oneDay).toBeLessThan(sameDay);
    expect(threeDays).toBeLessThan(oneDay);
  });

  it('returns zero once the dates are further apart than the matching window', () => {
    expect(matchScore(base, { ...base, occurredOn: '2026-04-15' })).toBe(0);
  });

  it('never returns a value outside zero to one', () => {
    const score = matchScore(base, { ...base });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
