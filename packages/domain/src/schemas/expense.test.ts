import { describe, expect, it } from 'vitest';

import { createExpenseInput, expenseFilter } from './expense';

const valid = {
  amountMinor: 1250,
  currency: 'USD',
  occurredOn: '2026-03-15',
  visibility: 'shared' as const,
  categoryId: '00000000-0000-4000-8000-000000000001',
  merchant: 'Blue Bottle Coffee',
};

describe('createExpenseInput', () => {
  it('accepts a well-formed expense', () => {
    expect(createExpenseInput.parse(valid)).toMatchObject(valid);
  });

  it('defaults visibility to shared', () => {
    const { visibility: _omitted, ...withoutVisibility } = valid;
    expect(createExpenseInput.parse(withoutVisibility).visibility).toBe('shared');
  });

  it('rejects a zero or negative amount', () => {
    expect(createExpenseInput.safeParse({ ...valid, amountMinor: 0 }).success).toBe(false);
    expect(createExpenseInput.safeParse({ ...valid, amountMinor: -1 }).success).toBe(false);
  });

  it('rejects a non-integer amount', () => {
    expect(createExpenseInput.safeParse({ ...valid, amountMinor: 12.5 }).success).toBe(false);
  });

  it('rejects a malformed currency', () => {
    expect(createExpenseInput.safeParse({ ...valid, currency: 'US' }).success).toBe(false);
    expect(createExpenseInput.safeParse({ ...valid, currency: 'usd' }).success).toBe(false);
  });

  it('rejects a malformed date', () => {
    expect(createExpenseInput.safeParse({ ...valid, occurredOn: '15/03/2026' }).success).toBe(
      false,
    );
    expect(createExpenseInput.safeParse({ ...valid, occurredOn: '2026-13-01' }).success).toBe(
      false,
    );
  });

  it('rejects an unknown visibility', () => {
    expect(createExpenseInput.safeParse({ ...valid, visibility: 'secret' }).success).toBe(false);
  });

  it('trims the merchant and treats blank as absent', () => {
    expect(createExpenseInput.parse({ ...valid, merchant: '  Tesco  ' }).merchant).toBe('Tesco');
    expect(createExpenseInput.parse({ ...valid, merchant: '   ' }).merchant).toBeUndefined();
  });

  it('allows the category to be omitted', () => {
    const { categoryId: _omitted, ...withoutCategory } = valid;
    expect(createExpenseInput.safeParse(withoutCategory).success).toBe(true);
  });

  it('rejects a category id that is not a uuid', () => {
    expect(createExpenseInput.safeParse({ ...valid, categoryId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });
});

describe('expenseFilter', () => {
  it('defaults to showing everything', () => {
    expect(expenseFilter.parse({}).scope).toBe('all');
  });

  it('accepts a date range and a category', () => {
    const parsed = expenseFilter.parse({
      from: '2026-03-01',
      to: '2026-03-31',
      categoryId: valid.categoryId,
      scope: 'personal',
    });

    expect(parsed.from).toBe('2026-03-01');
    expect(parsed.scope).toBe('personal');
  });

  it('rejects a range whose end precedes its start', () => {
    expect(expenseFilter.safeParse({ from: '2026-03-31', to: '2026-03-01' }).success).toBe(false);
  });
});
