import { describe, expect, it } from 'vitest';

import { anchorDayFor, createSubscriptionInput, subscriptionStatusSchema } from './subscription';

const VALID = {
  name: 'Netflix',
  amountMinor: 1599,
  currency: 'USD',
  cadence: 'monthly' as const,
  anchorDay: 12,
  startedOn: '2026-01-12',
};

describe('createSubscriptionInput', () => {
  it('accepts a plain monthly subscription', () => {
    expect(createSubscriptionInput.safeParse(VALID).success).toBe(true);
  });

  it('defaults to one interval and an active status', () => {
    const parsed = createSubscriptionInput.parse(VALID);

    expect(parsed.intervalCount).toBe(1);
    expect(parsed.status).toBe('active');
  });

  it('requires a name', () => {
    const parsed = createSubscriptionInput.safeParse({ ...VALID, name: '   ' });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('validation.subscription.nameRequired');
  });

  // The same trap as the expense amount: zero is not a subscription, and the
  // column's check constraint agrees.
  it('refuses an amount of zero', () => {
    const parsed = createSubscriptionInput.safeParse({ ...VALID, amountMinor: 0 });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('validation.amount.positive');
  });

  it('refuses an anchor day outside a month', () => {
    for (const anchorDay of [0, 32, 1.5]) {
      const parsed = createSubscriptionInput.safeParse({ ...VALID, anchorDay });

      expect(parsed.success, `${anchorDay} should be rejected`).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe('validation.subscription.anchorDay');
    }
  });

  it('accepts the 31st, which most months do not have', () => {
    // Deliberately allowed: it is the anchor, not a date. nextRenewalOn clamps
    // it per month, which is the whole reason the anchor is stored separately.
    expect(createSubscriptionInput.safeParse({ ...VALID, anchorDay: 31 }).success).toBe(true);
  });

  it('refuses an interval count below one', () => {
    const parsed = createSubscriptionInput.safeParse({ ...VALID, intervalCount: 0 });

    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe('validation.subscription.intervalCount');
  });
});

describe('subscriptionStatusSchema', () => {
  it('knows both states a subscription can be in', () => {
    expect(subscriptionStatusSchema.options).toEqual(['active', 'cancelled']);
  });
});

/**
 * The anchor is derived from the start date rather than asked for separately.
 * Nobody thinks of a subscription as "anchored on the 12th" — they know it
 * started on 12 January, and being asked twice for the same fact is how the
 * two end up disagreeing.
 */
describe('anchorDayFor', () => {
  it('takes the day of the month the subscription started', () => {
    expect(anchorDayFor('2026-01-12')).toBe(12);
    expect(anchorDayFor('2026-03-01')).toBe(1);
  });

  // Someone who signed up on 31 January bills on the 31st, and February is not
  // evidence they meant the 28th.
  it('keeps a month-end start as the month-end anchor', () => {
    expect(anchorDayFor('2026-01-31')).toBe(31);
  });

  it('refuses something that is not a date', () => {
    expect(() => anchorDayFor('the twelfth')).toThrow(/date/i);
  });
});

describe('a subscription on trial', () => {
  const base = {
    name: 'Netflix',
    amountMinor: 1599,
    currency: 'USD',
    cadence: 'monthly' as const,
    anchorDay: 12,
    startedOn: '2026-01-12',
  };

  it('accepts a length in free days', () => {
    const parsed = createSubscriptionInput.parse({ ...base, trialDays: 30 });

    expect(parsed.trialDays).toBe(30);
  });

  // Absent rather than zero: nought free days is not a trial, and a column
  // holding 0 would make "is this on trial" two questions instead of one.
  it('leaves it absent when there is no trial', () => {
    expect(createSubscriptionInput.parse(base).trialDays).toBeUndefined();
  });

  it('refuses a trial of no days at all', () => {
    expect(createSubscriptionInput.safeParse({ ...base, trialDays: 0 }).success).toBe(false);
  });

  /*
   * A year is the longest trial anybody actually offers. Past that it is a
   * typo, and a typo here pushes the first charge out of sight — which is the
   * one thing this feature exists to prevent.
   */
  it('refuses one longer than a year', () => {
    expect(createSubscriptionInput.safeParse({ ...base, trialDays: 400 }).success).toBe(false);
  });

  it('refuses a fractional number of days', () => {
    expect(createSubscriptionInput.safeParse({ ...base, trialDays: 7.5 }).success).toBe(false);
  });
});
