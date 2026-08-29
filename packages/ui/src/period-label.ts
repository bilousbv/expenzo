import { parseIsoDate, type DateRange } from '@expenzo/domain';

/**
 * A calendar date as a local `Date`, never as an instant.
 *
 * `new Date('2026-01-01')` is midnight UTC, which in any timezone behind it is
 * the previous day — so a period starting on the first would be labelled as
 * ending in December for half the world. Building from the parts sidesteps it.
 */
function localDate(iso: string): Date {
  const { year, month, day } = parseIsoDate(iso);

  return new Date(year, month - 1, day);
}

/** "Jan 26" — what the arrows produce as they step away from this month. */
export function formatMonthLabel(year: number, month: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: 'short', year: '2-digit' }).format(
    new Date(year, month - 1, 1),
  );
}

/** The exact range, shown under the name so a stepped month is unambiguous. */
export function formatRange(range: DateRange, locale: string): string {
  const format = new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return `${format.format(localDate(range.start))} — ${format.format(localDate(range.end))}`;
}
