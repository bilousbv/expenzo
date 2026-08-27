import { addDays, type IsoDate } from './period';

export interface DayGroup<T> {
  readonly date: string;
  readonly items: T[];
}

/**
 * Splits a list into one group per calendar day.
 *
 * Deliberately preserves the order the rows arrived in rather than sorting by
 * date. The expense list is keyset-paged and ordered by the database, so
 * re-sorting here would let a day from page two jump above one from page one
 * the moment a second page loaded.
 *
 * Rows for the same day are rejoined even when they are not adjacent, because
 * a day split across a page boundary would otherwise render its header twice.
 */
export function groupByDay<T>(items: readonly T[], dateOf: (item: T) => string): DayGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const date = dateOf(item);
    const existing = groups.get(date);

    if (existing) {
      existing.push(item);
    } else {
      groups.set(date, [item]);
    }
  }

  // Map iteration is insertion-ordered, which is exactly the first-seen order
  // the rows arrived in.
  return [...groups].map(([date, grouped]) => ({ date, items: grouped }));
}

/**
 * "Today" and "yesterday", or nothing.
 *
 * Returns a key rather than a word so the caller translates it — this package
 * stays free of locale. Anything older than yesterday returns null and is
 * formatted as a date, because "three days ago" stops being useful long before
 * it stops being accurate.
 */
export function relativeDayKey(date: string, today: string): 'today' | 'yesterday' | null {
  if (date === today) return 'today';
  if (date === addDays(today as IsoDate, -1)) return 'yesterday';

  return null;
}
