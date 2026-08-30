import { describe, expect, it } from 'vitest';

import {
  billingStartsOn,
  daysUntil,
  nextRenewalOn,
  renewalWindow,
  trialEndsOn,
  upcomingRenewals,
} from './renewal';

describe('nextRenewalOn', () => {
  it('advances a monthly subscription by one month', () => {
    expect(nextRenewalOn({ anchorDay: 15, cadence: 'monthly' }, '2026-01-15')).toBe('2026-02-15');
  });

  // The bug this whole design exists to prevent. A subscription anchored on the
  // 31st must clamp to the short month and then RECOVER, because the next date
  // is always computed from the anchor rather than by incrementing the last one.
  it('clamps to a short month without drifting afterwards', () => {
    const feb = nextRenewalOn({ anchorDay: 31, cadence: 'monthly' }, '2026-01-31');
    expect(feb).toBe('2026-02-28');

    const mar = nextRenewalOn({ anchorDay: 31, cadence: 'monthly' }, feb);
    expect(mar).toBe('2026-03-31');

    const apr = nextRenewalOn({ anchorDay: 31, cadence: 'monthly' }, mar);
    expect(apr).toBe('2026-04-30');

    const may = nextRenewalOn({ anchorDay: 31, cadence: 'monthly' }, apr);
    expect(may).toBe('2026-05-31');
  });

  it('clamps to 29 February in a leap year', () => {
    expect(nextRenewalOn({ anchorDay: 31, cadence: 'monthly' }, '2028-01-31')).toBe('2028-02-29');
  });

  it('handles a 30th anchor across February', () => {
    expect(nextRenewalOn({ anchorDay: 30, cadence: 'monthly' }, '2026-01-30')).toBe('2026-02-28');
    expect(nextRenewalOn({ anchorDay: 30, cadence: 'monthly' }, '2026-02-28')).toBe('2026-03-30');
  });

  it('supports weekly cadence', () => {
    expect(nextRenewalOn({ anchorDay: 1, cadence: 'weekly' }, '2026-03-04')).toBe('2026-03-11');
  });

  it('supports quarterly, semiannual and yearly cadence', () => {
    expect(nextRenewalOn({ anchorDay: 10, cadence: 'quarterly' }, '2026-01-10')).toBe('2026-04-10');
    expect(nextRenewalOn({ anchorDay: 10, cadence: 'semiannual' }, '2026-01-10')).toBe(
      '2026-07-10',
    );
    expect(nextRenewalOn({ anchorDay: 10, cadence: 'yearly' }, '2026-01-10')).toBe('2027-01-10');
  });

  it('honours an interval count', () => {
    expect(
      nextRenewalOn({ anchorDay: 10, cadence: 'monthly', intervalCount: 3 }, '2026-01-10'),
    ).toBe('2026-04-10');
  });

  it('always moves strictly forward', () => {
    const next = nextRenewalOn({ anchorDay: 15, cadence: 'monthly' }, '2026-01-15');
    expect(next > '2026-01-15').toBe(true);
  });

  it('rejects an anchor day outside 1 to 31', () => {
    expect(() => nextRenewalOn({ anchorDay: 0, cadence: 'monthly' }, '2026-01-15')).toThrow();
    expect(() => nextRenewalOn({ anchorDay: 32, cadence: 'monthly' }, '2026-01-15')).toThrow();
  });
});

describe('upcomingRenewals', () => {
  it('lists the renewals falling inside a window', () => {
    expect(upcomingRenewals({ anchorDay: 5, cadence: 'monthly' }, '2026-01-05', 3)).toEqual([
      '2026-02-05',
      '2026-03-05',
      '2026-04-05',
    ]);
  });

  it('keeps the anchor stable across a short month', () => {
    expect(upcomingRenewals({ anchorDay: 31, cadence: 'monthly' }, '2026-01-31', 3)).toEqual([
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ]);
  });
});

describe('renewalWindow', () => {
  /*
   * Both ends inclusive, and the far end is a full week out: a charge landing
   * exactly a week from today is what somebody means by "this coming week",
   * and a weekly subscription would otherwise never appear on the card at all.
   */
  it('runs from today to a week ahead', () => {
    expect(renewalWindow('2026-08-29')).toEqual({ start: '2026-08-29', end: '2026-09-05' });
  });

  it('takes a different width when asked for one', () => {
    expect(renewalWindow('2026-08-29', 3)).toEqual({ start: '2026-08-29', end: '2026-09-01' });
  });

  // Today's charge has not been taken until the merchant takes it, so it is
  // still something to know about rather than history.
  it('includes today', () => {
    expect(renewalWindow('2026-12-31').start).toBe('2026-12-31');
  });

  it('carries across a year end', () => {
    expect(renewalWindow('2026-12-28').end).toBe('2027-01-04');
  });

  it('refuses a window that is not a positive number of days', () => {
    expect(() => renewalWindow('2026-08-29', 0)).toThrow();
    expect(() => renewalWindow('2026-08-29', -1)).toThrow();
    expect(() => renewalWindow('2026-08-29', 1.5)).toThrow();
  });
});

describe('daysUntil', () => {
  it('counts whole calendar days between two dates', () => {
    expect(daysUntil('2026-08-29', '2026-09-05')).toBe(7);
  });

  it('is zero for the same day', () => {
    expect(daysUntil('2026-08-29', '2026-08-29')).toBe(0);
  });

  /*
   * Counted on the calendar rather than in hours, so a date that crosses a
   * daylight-saving boundary is still a whole number of days away. Europe
   * changes clocks on 25 October 2026.
   */
  it('is unaffected by a clock change in between', () => {
    expect(daysUntil('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('goes negative for a date already past', () => {
    expect(daysUntil('2026-08-29', '2026-08-27')).toBe(-2);
  });
});

describe('trialEndsOn', () => {
  /*
   * The free period runs from the day the subscription started, so a 30-day
   * trial begun on the 1st ends on the 31st — the day the merchant takes the
   * first payment, which is the only date worth putting in front of somebody.
   */
  it('counts the free days from the start date', () => {
    expect(trialEndsOn('2026-08-01', 30)).toBe('2026-08-31');
  });

  it('carries across a month end', () => {
    expect(trialEndsOn('2026-08-29', 7)).toBe('2026-09-05');
  });

  it('carries across a year end', () => {
    expect(trialEndsOn('2026-12-20', 14)).toBe('2027-01-03');
  });

  it('refuses a trial that is not a positive whole number of days', () => {
    expect(() => trialEndsOn('2026-08-01', 0)).toThrow();
    expect(() => trialEndsOn('2026-08-01', -7)).toThrow();
    expect(() => trialEndsOn('2026-08-01', 1.5)).toThrow();
  });
});

describe('billingStartsOn', () => {
  /*
   * Billing runs from the end of the trial rather than from the sign-up date,
   * which is what makes the anchor day come out right: a trial started on the
   * 1st and lasting 30 days bills on the 31st and monthly from there. Mirrors
   * the coalesce in app.set_subscription_next_renewal.
   */
  it('is the end of the trial when there is one', () => {
    expect(billingStartsOn('2026-08-01', 30)).toBe('2026-08-31');
  });

  it('is the start date when there is not', () => {
    expect(billingStartsOn('2026-08-01')).toBe('2026-08-01');
    expect(billingStartsOn('2026-08-01', undefined)).toBe('2026-08-01');
  });
});
