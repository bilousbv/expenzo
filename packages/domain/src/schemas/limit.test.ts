import { describe, expect, it } from 'vitest';

import { createLimitInput, limitProgress, updateLimitInput } from './limit';

const CATEGORY = '11111111-1111-4111-8111-111111111111';

describe('createLimitInput', () => {
  it('accepts a category limit', () => {
    const parsed = createLimitInput.parse({ categoryId: CATEGORY, amountMinor: 50000 });

    expect(parsed).toEqual({ categoryId: CATEGORY, amountMinor: 50000, period: 'monthly' });
  });

  // Absent rather than null: the household-wide limit is the one with no
  // category, and the repository turns that into a NULL column.
  it('accepts a household-wide limit with no category', () => {
    expect(createLimitInput.parse({ amountMinor: 200000 }).categoryId).toBeUndefined();
  });

  it('defaults the period to monthly', () => {
    expect(createLimitInput.parse({ amountMinor: 1 }).period).toBe('monthly');
  });

  it('knows the periods the UI does not offer yet', () => {
    expect(createLimitInput.safeParse({ amountMinor: 1, period: 'weekly' }).success).toBe(true);
    expect(createLimitInput.safeParse({ amountMinor: 1, period: 'yearly' }).success).toBe(true);
    expect(createLimitInput.safeParse({ amountMinor: 1, period: 'daily' }).success).toBe(false);
  });

  // A limit of zero is a ban rather than a limit, and the column's check
  // constraint agrees.
  it('rejects zero and negative limits', () => {
    expect(createLimitInput.safeParse({ amountMinor: 0 }).success).toBe(false);
    expect(createLimitInput.safeParse({ amountMinor: -1 }).success).toBe(false);
  });

  it('rejects a fractional limit, since amounts are minor units', () => {
    expect(createLimitInput.safeParse({ amountMinor: 12.5 }).success).toBe(false);
  });
});

describe('updateLimitInput', () => {
  it('requires an id and an amount', () => {
    expect(updateLimitInput.safeParse({ amountMinor: 100 }).success).toBe(false);
    expect(updateLimitInput.parse({ id: CATEGORY, amountMinor: 100 }).amountMinor).toBe(100);
  });

  // Moving a limit from one category to another is indistinguishable from
  // setting a different limit, and would slip past the unique index.
  it('cannot move a limit to another category', () => {
    expect(updateLimitInput.parse({ id: CATEGORY, amountMinor: 100 })).not.toHaveProperty(
      'categoryId',
    );
  });
});

describe('limitProgress', () => {
  it('reports the fraction spent', () => {
    expect(limitProgress(2500, 10000)).toEqual({
      spentMinor: 2500,
      limitMinor: 10000,
      ratio: 0.25,
      exceeded: false,
    });
  });

  // Spending exactly the limit is staying within it. A bar that flips to red on
  // the last penny of an allowance nobody has overspent is simply wrong.
  it('treats spending exactly the limit as within it', () => {
    expect(limitProgress(10000, 10000).exceeded).toBe(false);
    expect(limitProgress(10001, 10000).exceeded).toBe(true);
  });

  it('reports a ratio above one rather than clamping it', () => {
    expect(limitProgress(15000, 10000).ratio).toBe(1.5);
  });

  // Most categories have no limit. They still need a spent figure, and must not
  // be rendered as though they were at zero percent of something.
  it('has no ratio when no limit is set', () => {
    expect(limitProgress(2500, null)).toEqual({
      spentMinor: 2500,
      limitMinor: null,
      ratio: null,
      exceeded: false,
    });
  });

  it('treats a zero limit as no limit rather than dividing by it', () => {
    expect(limitProgress(2500, 0).ratio).toBeNull();
  });
});
