import { describe, expect, it } from 'vitest';

import { localDateIn, monthBounds, presetRange, weekBounds } from './period';

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
