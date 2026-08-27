import { describe, expect, it } from 'vitest';

import { groupByDay, relativeDayKey } from './grouping';

interface Row {
  id: string;
  on: string;
  amount: number;
}

const rows: Row[] = [
  { id: 'a', on: '2026-08-27', amount: 500 },
  { id: 'b', on: '2026-08-27', amount: -120 },
  { id: 'c', on: '2026-08-26', amount: -80 },
  { id: 'd', on: '2026-08-24', amount: -200 },
];

describe('groupByDay', () => {
  it('puts everything from one day in one group', () => {
    const groups = groupByDay(rows, (row) => row.on);

    expect(groups).toHaveLength(3);
    expect(groups[0]?.items.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('keeps the order the rows arrived in', () => {
    const groups = groupByDay(rows, (row) => row.on);

    expect(groups.map((group) => group.date)).toEqual(['2026-08-27', '2026-08-26', '2026-08-24']);
  });

  /**
   * The list is keyset-paged and ordered by the database, so grouping must not
   * re-sort: a group that jumped to the top because its date sorted higher
   * would put a page-two day above a page-one day.
   */
  it('does not re-sort, even when the input is not in date order', () => {
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];

    expect(groupByDay(shuffled, (row) => row.on).map((group) => group.date)).toEqual([
      '2026-08-26',
      '2026-08-27',
    ]);
  });

  // A day split across a page boundary would otherwise render two headers for
  // the same date, one above the other.
  it('rejoins a day whose rows are not adjacent', () => {
    const split = [rows[0]!, rows[2]!, rows[1]!];
    const groups = groupByDay(split, (row) => row.on);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.items.map((row) => row.id)).toEqual(['a', 'b']);
  });

  it('has nothing to group when there are no rows', () => {
    expect(groupByDay([], (row: Row) => row.on)).toEqual([]);
  });
});

describe('relativeDayKey', () => {
  it('names today and yesterday', () => {
    expect(relativeDayKey('2026-08-27', '2026-08-27')).toBe('today');
    expect(relativeDayKey('2026-08-26', '2026-08-27')).toBe('yesterday');
  });

  // Anything older gets the date itself, because "3 days ago" stops being
  // useful long before it stops being correct.
  it('leaves anything older to be formatted as a date', () => {
    expect(relativeDayKey('2026-08-25', '2026-08-27')).toBeNull();
  });

  // A back-dated expense can legitimately sit in the future when the household
  // timezone is behind whoever entered it.
  it('leaves a future date alone too', () => {
    expect(relativeDayKey('2026-08-28', '2026-08-27')).toBeNull();
  });

  it('crosses a month boundary', () => {
    expect(relativeDayKey('2026-07-31', '2026-08-01')).toBe('yesterday');
  });
});
