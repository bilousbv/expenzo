import { describe, expect, it } from 'vitest';

import { formatMonthLabel, formatRange } from './period-label';

describe('formatMonthLabel', () => {
  /*
   * A short month and a two-digit year: "Jan 26" is what the arrows produce as
   * they step, and it has to stay narrow enough to sit between them.
   */
  it('reads as a short month and year', () => {
    expect(formatMonthLabel(2026, 1, 'en-US')).toMatch(/Jan/);
    expect(formatMonthLabel(2026, 1, 'en-US')).toMatch(/26/);
  });

  // The month name is language-dependent, which is the whole reason this is not
  // a hard-coded table.
  it('is written in the reader’s language', () => {
    expect(formatMonthLabel(2026, 1, 'uk-UA')).not.toMatch(/Jan/);
  });
});

describe('formatRange', () => {
  it('shows both ends of the range', () => {
    const shown = formatRange({ start: '2026-01-01', end: '2026-02-28' }, 'en-GB');

    expect(shown).toContain('2026');
    expect(shown).toMatch(/01|1/);
  });

  // A range is two dates and a separator, and the separator has to survive a
  // language that writes dates differently.
  it('separates the two ends', () => {
    expect(formatRange({ start: '2026-01-01', end: '2026-01-31' }, 'uk-UA')).toContain('—');
  });

  /*
   * Built from the calendar parts rather than by parsing the string as an
   * instant: `new Date('2026-01-01')` is midnight UTC, which in any timezone
   * behind it is the previous day, and the period label would read a day early
   * for half the world.
   */
  it('does not shift the date into the previous day', () => {
    expect(formatRange({ start: '2026-01-01', end: '2026-01-31' }, 'en-GB')).not.toContain('31/12');
  });
});
