import { TZDate } from '@date-fns/tz';

/**
 * Calendar arithmetic in a specific timezone.
 *
 * An expense entered at 23:30 on 31 March in Madrid belongs to March. Storing
 * only the instant and grouping it by UTC would file it under April, so every
 * grouping in this product runs on a local calendar date frozen at write time.
 */

/** A date as YYYY-MM-DD. Deliberately a string: it is a calendar day, not an instant. */
export type IsoDate = string;

export interface DateRange {
  readonly start: IsoDate;
  readonly end: IsoDate;
}

/** Day of week, 0 = Sunday through 6 = Saturday, matching Date.getUTCDay. */
export type WeekStart = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

function toIsoDate(year: number, month: number, day: number): IsoDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

export function parseIsoDate(value: IsoDate): { year: number; month: number; day: number } {
  if (!DATE_PATTERN.test(value)) {
    throw new Error(`Not an ISO date: ${JSON.stringify(value)}`);
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new Error(`Not a real calendar date: ${value}`);
  }

  return { year, month, day };
}

export function isIsoDate(value: string): boolean {
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

/** Days in a given month. Month is 1-based. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the following month is the last day of this one.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * The local calendar date an instant falls on in the given timezone.
 * This is what gets frozen into `expenses.occurred_on`.
 */
export function localDateIn(instant: string | Date, timeZone: string): IsoDate {
  const zoned = new TZDate(new Date(instant), timeZone);
  return toIsoDate(zoned.getFullYear(), zoned.getMonth() + 1, zoned.getDate());
}

/** First and last local day of the month the instant falls in. */
export function monthBounds(instant: string | Date, timeZone: string): DateRange {
  const { year, month } = parseIsoDate(localDateIn(instant, timeZone));

  return {
    start: toIsoDate(year, month, 1),
    end: toIsoDate(year, month, daysInMonth(year, month)),
  };
}

function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));

  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** First and last local day of the week the instant falls in. */
export function weekBounds(
  instant: string | Date,
  timeZone: string,
  weekStartsOn: WeekStart = 1,
): DateRange {
  const local = localDateIn(instant, timeZone);
  const { year, month, day } = parseIsoDate(local);

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const offset = (dayOfWeek - weekStartsOn + 7) % 7;

  const start = addDays(local, -offset);
  return { start, end: addDays(start, 6) };
}

export { addDays, toIsoDate };

/** The periods the dashboard offers, in the order they are shown. */
export const PERIOD_PRESETS = ['this-month', 'last-month', 'this-week'] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  'this-week': 'This week',
};

/**
 * The date range a named period covers, in the household's timezone.
 *
 * Resolved here rather than in each screen so the web and native dashboards
 * cannot disagree about when last month started — and so "last month" on the
 * first of January is December of the previous year rather than month zero.
 */
export function presetRange(
  preset: PeriodPreset,
  instant: string | Date,
  timeZone: string,
): DateRange {
  if (preset === 'this-week') return weekBounds(instant, timeZone);
  if (preset === 'this-month') return monthBounds(instant, timeZone);

  const { year, month } = parseIsoDate(localDateIn(instant, timeZone));
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return {
    start: toIsoDate(previousYear, previousMonth, 1),
    end: toIsoDate(previousYear, previousMonth, daysInMonth(previousYear, previousMonth)),
  };
}
