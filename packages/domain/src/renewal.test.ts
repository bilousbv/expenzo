import { describe, expect, it } from 'vitest';

import { nextRenewalOn, upcomingRenewals } from './renewal';

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
