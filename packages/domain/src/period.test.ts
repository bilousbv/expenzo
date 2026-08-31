import { describe, expect, it } from 'vitest';

import {
  periodUnit,
  shiftPeriod,
  describePeriod,
  isWholeMonth,
  limitPeriodBounds,
  localDateIn,
  monthBounds,
  PERIOD_PRESETS,
  presetRange,
  shiftMonth,
  weekBounds,
} from './period';

describe('localDateIn', () => {
  // The single most important behaviour in this file. An expense entered at
  // 23:30 on 31 March in Madrid is a MARCH expense. Storing only the instant
  // and grouping by UTC would file it under April.
  it('uses the local calendar date, not the UTC one', () => {
    expect(localDateIn('2026-03-31T23:30:00Z', 'Europe/Madrid')).toBe('2026-04-01');
    expect(localDateIn('2026-03-31T21:30:00Z', 'Europe/Madrid')).toBe('2026-03-31');
  });

  it('handles timezones behind UTC', () => {
    expect(localDateIn('2026-04-01T02:00:00Z', 'America/New_York')).toBe('2026-03-31');
  });

  it('is the identity for UTC', () => {
    expect(localDateIn('2026-03-31T23:30:00Z', 'UTC')).toBe('2026-03-31');
  });
});

describe('monthBounds', () => {
  it('returns the first and last local day of the month', () => {
    expect(monthBounds('2026-03-15T12:00:00Z', 'UTC')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });

  it('handles February in a leap year', () => {
    expect(monthBounds('2028-02-10T12:00:00Z', 'UTC')).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });

  it('handles February in a non-leap year', () => {
    expect(monthBounds('2026-02-10T12:00:00Z', 'UTC')).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  // Same trap as localDateIn: the instant is in April UTC but March locally.
  it('brackets the month the instant falls in locally', () => {
    expect(monthBounds('2026-04-01T01:00:00Z', 'America/New_York')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });

  // Spanning a DST transition must not shift the boundaries by a day.
  it('is unaffected by a daylight-saving transition', () => {
    expect(monthBounds('2026-03-29T12:00:00Z', 'Europe/Madrid')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });
});

describe('weekBounds', () => {
  it('starts the week on Monday by default', () => {
    // 2026-03-18 is a Wednesday.
    expect(weekBounds('2026-03-18T12:00:00Z', 'UTC')).toEqual({
      start: '2026-03-16',
      end: '2026-03-22',
    });
  });

  it('honours a Sunday week start', () => {
    expect(weekBounds('2026-03-18T12:00:00Z', 'UTC', 0)).toEqual({
      start: '2026-03-15',
      end: '2026-03-21',
    });
  });
});

describe('presetRange', () => {
  const MADRID = 'Europe/Madrid';

  it('covers the whole of the current month', () => {
    expect(presetRange('this-month', '2026-03-15T12:00:00Z', MADRID)).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });

  it('covers the whole of the previous month', () => {
    expect(presetRange('last-month', '2026-03-15T12:00:00Z', MADRID)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  // Month zero does not exist. Naive arithmetic on the month number gives
  // 2026-00-01, which is either a crash or silently December of the wrong year.
  it('rolls back across the new year', () => {
    expect(presetRange('last-month', '2026-01-05T12:00:00Z', MADRID)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  it('gets February right in a leap year', () => {
    expect(presetRange('last-month', '2024-03-10T12:00:00Z', MADRID)).toEqual({
      start: '2024-02-01',
      end: '2024-02-29',
    });
  });

  it('covers the current week, Monday to Sunday', () => {
    // 2026-03-15 is a Sunday.
    expect(presetRange('this-week', '2026-03-15T12:00:00Z', MADRID)).toEqual({
      start: '2026-03-09',
      end: '2026-03-15',
    });
  });

  // The instant is 23:30 UTC on the 31st, which is already the 1st in Madrid.
  // Resolving the period in the household's timezone is the whole point.
  it('uses the household timezone rather than UTC', () => {
    expect(presetRange('this-month', '2026-03-31T23:30:00Z', MADRID).start).toBe('2026-04-01');
    expect(presetRange('this-month', '2026-03-31T23:30:00Z', 'UTC').start).toBe('2026-03-01');
  });
});

describe('the presets the period picker offers', () => {
  const TZ = 'Europe/Madrid';

  it('covers this quarter', () => {
    expect(presetRange('this-quarter', '2026-05-14T10:00:00Z', TZ)).toEqual({
      start: '2026-04-01',
      end: '2026-06-30',
    });
  });

  // Q1 of the following year, so the previous quarter has to cross the year.
  it('covers last quarter, across a year boundary', () => {
    expect(presetRange('last-quarter', '2026-02-10T10:00:00Z', TZ)).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    });
  });

  it('covers this year', () => {
    expect(presetRange('this-year', '2026-08-28T10:00:00Z', TZ)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('covers last year', () => {
    expect(presetRange('last-year', '2026-08-28T10:00:00Z', TZ)).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
  });

  it('still covers the three it offered before', () => {
    expect(PERIOD_PRESETS).toContain('this-month');
    expect(PERIOD_PRESETS).toContain('last-month');
    expect(PERIOD_PRESETS).toContain('this-week');
  });
});

describe('shiftMonth', () => {
  /*
   * The arrows step whole months. Stepping by adding or subtracting days would
   * drift: a month is not a fixed number of them.
   */
  it('steps back a month', () => {
    expect(shiftMonth({ start: '2026-03-01', end: '2026-03-31' }, -1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('steps forward a month', () => {
    expect(shiftMonth({ start: '2026-01-01', end: '2026-01-31' }, 1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  // Stepping out of January has to land in the previous year rather than in
  // month zero.
  it('crosses the year backwards', () => {
    expect(shiftMonth({ start: '2026-01-01', end: '2026-01-31' }, -1)).toEqual({
      start: '2025-12-01',
      end: '2025-12-31',
    });
  });

  it('crosses the year forwards', () => {
    expect(shiftMonth({ start: '2026-12-01', end: '2026-12-31' }, 1)).toEqual({
      start: '2027-01-01',
      end: '2027-01-31',
    });
  });

  // A leap February is 29 days, and the end of the range has to be the real
  // last day rather than a copied 28th.
  it('lands on the real last day of a leap February', () => {
    expect(shiftMonth({ start: '2028-01-01', end: '2028-01-31' }, 1)).toEqual({
      start: '2028-02-01',
      end: '2028-02-29',
    });
  });
});

describe('isWholeMonth', () => {
  /*
   * The arrows only make sense while the period is a single whole month:
   * stepping an arbitrary range by a month is not a thing anybody asked for.
   * This is what decides whether they are shown.
   */
  it('recognises a whole month', () => {
    expect(isWholeMonth({ start: '2026-02-01', end: '2026-02-28' })).toBe(true);
    expect(isWholeMonth({ start: '2028-02-01', end: '2028-02-29' })).toBe(true);
  });

  it('rejects a part of one', () => {
    expect(isWholeMonth({ start: '2026-02-01', end: '2026-02-14' })).toBe(false);
    expect(isWholeMonth({ start: '2026-02-02', end: '2026-02-28' })).toBe(false);
  });

  it('rejects a range spanning two months', () => {
    expect(isWholeMonth({ start: '2026-01-01', end: '2026-02-28' })).toBe(false);
  });
});

describe('describePeriod', () => {
  const TZ = 'Europe/Madrid';
  const NOW = '2026-03-15T10:00:00Z';

  /*
   * A range that is exactly a preset is named as that preset. "This month"
   * reads better than "Mar 26" for the period you are almost always on, and it
   * is what tells you the dashboard is where it started.
   */
  it('names a range that is exactly a preset', () => {
    expect(describePeriod(presetRange('this-month', NOW, TZ), NOW, TZ)).toEqual({
      kind: 'preset',
      preset: 'this-month',
    });
    expect(describePeriod(presetRange('last-quarter', NOW, TZ), NOW, TZ)).toEqual({
      kind: 'preset',
      preset: 'last-quarter',
    });
  });

  /*
   * Any other whole month is named as that month, which is what the arrows
   * produce as they step away from the current one.
   */
  it('names any other whole month by its month', () => {
    expect(describePeriod({ start: '2026-01-01', end: '2026-01-31' }, NOW, TZ)).toEqual({
      kind: 'month',
      year: 2026,
      month: 1,
    });
  });

  // Anything else has no name worth inventing; the dates underneath say it.
  it('calls anything else custom', () => {
    expect(describePeriod({ start: '2026-01-05', end: '2026-02-14' }, NOW, TZ)).toEqual({
      kind: 'custom',
    });
  });

  /*
   * This month is also a whole month, so the order matters: checked as a preset
   * first, or the dashboard would open reading "Mar 26" instead of "This month".
   */
  it('prefers the preset name over the month name', () => {
    expect(describePeriod({ start: '2026-03-01', end: '2026-03-31' }, NOW, TZ)).toMatchObject({
      kind: 'preset',
      preset: 'this-month',
    });
  });
});

describe('periodUnit', () => {
  /*
   * What the arrows step by. Detected from the range rather than remembered
   * from the preset that produced it, so a period restored from a URL steps
   * the same way as one just chosen — the URL carries two dates and nothing
   * about how they were arrived at.
   */
  it('recognises a whole year', () => {
    expect(periodUnit({ start: '2026-01-01', end: '2026-12-31' })).toBe('year');
  });

  it('recognises a whole quarter', () => {
    expect(periodUnit({ start: '2026-01-01', end: '2026-03-31' })).toBe('quarter');
    expect(periodUnit({ start: '2026-10-01', end: '2026-12-31' })).toBe('quarter');
  });

  it('recognises a whole month', () => {
    expect(periodUnit({ start: '2026-02-01', end: '2026-02-28' })).toBe('month');
    expect(periodUnit({ start: '2028-02-01', end: '2028-02-29' })).toBe('month');
  });

  it('recognises a week', () => {
    expect(periodUnit({ start: '2026-03-02', end: '2026-03-08' })).toBe('week');
  });

  // Anything else has no unit to step by, which is what hides the arrows.
  it('gives no unit to an arbitrary range', () => {
    expect(periodUnit({ start: '2026-01-05', end: '2026-02-14' })).toBeNull();
    expect(periodUnit({ start: '2026-02-01', end: '2026-02-14' })).toBeNull();
  });

  /*
   * A year is checked before a quarter and a quarter before a month, because
   * each starts on the first of a month and only the end tells them apart.
   */
  it('prefers the largest unit that fits', () => {
    expect(periodUnit({ start: '2026-01-01', end: '2026-12-31' })).not.toBe('quarter');
    expect(periodUnit({ start: '2026-01-01', end: '2026-03-31' })).not.toBe('month');
  });
});

describe('shiftPeriod', () => {
  it('steps a month by a month', () => {
    expect(shiftPeriod({ start: '2026-01-01', end: '2026-01-31' }, 1)).toEqual({
      start: '2026-02-01',
      end: '2026-02-28',
    });
  });

  it('steps a quarter by a quarter', () => {
    expect(shiftPeriod({ start: '2026-04-01', end: '2026-06-30' }, 1)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
    });
  });

  // Q1 stepped back is the previous year's Q4, not month zero.
  it('steps a quarter across the year', () => {
    expect(shiftPeriod({ start: '2026-01-01', end: '2026-03-31' }, -1)).toEqual({
      start: '2025-10-01',
      end: '2025-12-31',
    });
  });

  it('steps a year by a year', () => {
    expect(shiftPeriod({ start: '2026-01-01', end: '2026-12-31' }, -1)).toEqual({
      start: '2025-01-01',
      end: '2025-12-31',
    });
  });

  it('steps a week by seven days, across a month', () => {
    expect(shiftPeriod({ start: '2026-03-30', end: '2026-04-05' }, 1)).toEqual({
      start: '2026-04-06',
      end: '2026-04-12',
    });
  });

  /*
   * A range with no unit is returned untouched. The arrows are hidden for it,
   * so this only matters if something ever calls it anyway — and moving an
   * arbitrary range by a guessed amount would be worse than doing nothing.
   */
  it('leaves an arbitrary range alone', () => {
    const odd = { start: '2026-01-05', end: '2026-02-14' };

    expect(shiftPeriod(odd, 1)).toEqual(odd);
  });

  // Stepping away and back has to land exactly where it started, or the arrows
  // drift a day at a time across a month-end.
  it('is reversible', () => {
    for (const range of [
      { start: '2026-01-01', end: '2026-01-31' },
      { start: '2026-01-01', end: '2026-03-31' },
      { start: '2026-01-01', end: '2026-12-31' },
      { start: '2026-03-02', end: '2026-03-08' },
    ]) {
      expect(shiftPeriod(shiftPeriod(range, 1), -1)).toEqual(range);
    }
  });
});

/*
 * Mirrors app.period_bounds. The two must agree: the dashboard reads
 * "480 of 500" from this one, and the SQL decides whether a notification
 * fires. Two answers to one question is how a screen and an alert come to
 * contradict each other, and the pgTAP suite asserts the same cases.
 *
 * Takes a date rather than an instant, because occurred_on is already the
 * household's local calendar date — there is no timezone left to apply.
 */
describe('limitPeriodBounds', () => {
  it('runs a monthly period from the first to the last of the month', () => {
    expect(limitPeriodBounds('monthly', '2026-03-15')).toEqual({
      start: '2026-03-01',
      end: '2026-03-31',
    });
  });

  it('ends a monthly period on the last day, however short the month', () => {
    expect(limitPeriodBounds('monthly', '2026-02-15').end).toBe('2026-02-28');
    expect(limitPeriodBounds('monthly', '2028-02-10').end).toBe('2028-02-29');
  });

  it('runs a yearly period from January to December', () => {
    expect(limitPeriodBounds('yearly', '2026-03-15')).toEqual({
      start: '2026-01-01',
      end: '2026-12-31',
    });
  });

  it('runs a weekly period for seven days from the household week start', () => {
    const week = limitPeriodBounds('weekly', '2026-03-15', 1);

    expect(week.start).toBe('2026-03-09');
    expect(week.end).toBe('2026-03-15');
  });

  // week_starts_on is 0 to 6 with Sunday at zero, the same convention as
  // weekBounds and as the column on households.
  it('honours a household that starts its week on Sunday', () => {
    expect(limitPeriodBounds('weekly', '2026-03-15', 0)).toEqual({
      start: '2026-03-15',
      end: '2026-03-21',
    });
  });

  it('contains the date it was asked about', () => {
    for (const period of ['weekly', 'monthly', 'yearly'] as const) {
      const bounds = limitPeriodBounds(period, '2026-12-31');

      expect(bounds.start <= '2026-12-31').toBe(true);
      expect(bounds.end >= '2026-12-31').toBe(true);
    }
  });
});
