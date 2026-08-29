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
export const PERIOD_PRESETS = [
  'this-month',
  'last-month',
  'this-quarter',
  'last-quarter',
  'this-year',
  'last-year',
  'this-week',
] as const;

export type PeriodPreset = (typeof PERIOD_PRESETS)[number];

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

  if (preset === 'this-year') {
    return { start: toIsoDate(year, 1, 1), end: toIsoDate(year, 12, 31) };
  }

  if (preset === 'last-year') {
    return { start: toIsoDate(year - 1, 1, 1), end: toIsoDate(year - 1, 12, 31) };
  }

  if (preset === 'this-quarter') return quarterOf(year, month);

  if (preset === 'last-quarter') {
    // Stepped back three months from the start of this quarter, so the first
    // quarter of a year lands in the last quarter of the previous one rather
    // than in month zero.
    const previous = parseIsoDate(shiftMonth(quarterOf(year, month), -3).start);

    return quarterOf(previous.year, previous.month);
  }

  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;

  return {
    start: toIsoDate(previousYear, previousMonth, 1),
    end: toIsoDate(previousYear, previousMonth, daysInMonth(previousYear, previousMonth)),
  };
}

/** First and last day of the quarter containing the given month. */
function quarterOf(year: number, month: number): DateRange {
  const firstMonth = Math.floor((month - 1) / 3) * 3 + 1;
  const lastMonth = firstMonth + 2;

  return {
    start: toIsoDate(year, firstMonth, 1),
    end: toIsoDate(year, lastMonth, daysInMonth(year, lastMonth)),
  };
}

/**
 * Moves a whole-month range by whole months.
 *
 * Months are not a fixed number of days, so this steps the calendar rather than
 * adding days — and the end lands on the real last day of wherever it arrives,
 * which is what makes February behave in a leap year.
 */
export function shiftMonth(range: DateRange, months: number): DateRange {
  const { year, month } = parseIsoDate(range.start);
  const zeroBased = year * 12 + (month - 1) + months;
  const shiftedYear = Math.floor(zeroBased / 12);
  const shiftedMonth = (zeroBased % 12) + 1;

  return {
    start: toIsoDate(shiftedYear, shiftedMonth, 1),
    end: toIsoDate(shiftedYear, shiftedMonth, daysInMonth(shiftedYear, shiftedMonth)),
  };
}

/**
 * Whether a range is exactly one calendar month.
 *
 * This is what decides whether the stepping arrows are shown: stepping an
 * arbitrary range forward by a month is not a thing anybody asked for, so the
 * arrows exist only while the period is a month.
 */
export function isWholeMonth(range: DateRange): boolean {
  const { year, month, day } = parseIsoDate(range.start);

  if (day !== 1) return false;

  return range.end === toIsoDate(year, month, daysInMonth(year, month));
}

/**
 * What the period control should call a range.
 *
 * Returned as a shape rather than a string because this package holds no
 * locale: the caller turns `preset` into "This month" and `month` into "Jan 26"
 * in whatever language it is rendering.
 */
export type PeriodDescription =
  | { kind: 'preset'; preset: PeriodPreset }
  | { kind: 'month'; year: number; month: number }
  | { kind: 'custom' };

export function describePeriod(
  range: DateRange,
  instant: string | Date,
  timeZone: string,
): PeriodDescription {
  /*
   * Presets first. "This month" is also a whole month, and naming it "Mar 26"
   * would leave the dashboard's own default looking like somewhere you had
   * navigated to.
   */
  for (const preset of PERIOD_PRESETS) {
    const candidate = presetRange(preset, instant, timeZone);

    if (candidate.start === range.start && candidate.end === range.end) {
      return { kind: 'preset', preset };
    }
  }

  if (isWholeMonth(range)) {
    const { year, month } = parseIsoDate(range.start);

    return { kind: 'month', year, month };
  }

  // Nothing worth inventing a name for. The dates underneath say what it is.
  return { kind: 'custom' };
}

/** The units the stepping arrows can move a period by. */
export type PeriodUnit = 'week' | 'month' | 'quarter' | 'year';

/**
 * What a range can be stepped by, or null when nothing sensible applies.
 *
 * Detected from the dates rather than remembered from the preset that produced
 * them. The period travels as two dates — in a URL on web, in route params on
 * native — and carries nothing about how it was arrived at, so a period
 * restored from a link has to step the same way as one just chosen.
 *
 * Largest unit first: a year, a quarter and a month all start on the first of a
 * month, and only the end tells them apart.
 */
export function periodUnit(range: DateRange): PeriodUnit | null {
  const { year, month, day } = parseIsoDate(range.start);

  if (day === 1) {
    if (month === 1 && range.end === toIsoDate(year, 12, 31)) return 'year';

    const quarter = quarterOf(year, month);
    if (quarter.start === range.start && quarter.end === range.end) return 'quarter';

    if (range.end === toIsoDate(year, month, daysInMonth(year, month))) return 'month';
  }

  // Seven days inclusive, wherever it starts: a week does not have to begin on
  // the first of anything.
  if (addDays(range.start, 6) === range.end) return 'week';

  return null;
}

/**
 * Moves a period by whole units of its own kind.
 *
 * A month steps by a month, a quarter by a quarter, a year by a year and a week
 * by seven days — so the arrows always land on a period of the same shape, and
 * stepping away and back returns exactly where it started.
 */
export function shiftPeriod(range: DateRange, steps: number): DateRange {
  const unit = periodUnit(range);

  // Nothing sensible to move it by. The arrows are hidden for such a range, so
  // this only matters if something calls it anyway — and moving an arbitrary
  // range by a guessed amount is worse than doing nothing.
  if (!unit) return range;

  if (unit === 'week') {
    return { start: addDays(range.start, steps * 7), end: addDays(range.end, steps * 7) };
  }

  if (unit === 'month') return shiftMonth(range, steps);

  const months = unit === 'quarter' ? 3 : 12;
  const start = shiftMonth({ start: range.start, end: range.start }, steps * months).start;
  const { year, month } = parseIsoDate(start);

  if (unit === 'quarter') return quarterOf(year, month);

  return { start: toIsoDate(year, 1, 1), end: toIsoDate(year, 12, 31) };
}
