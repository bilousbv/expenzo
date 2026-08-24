import { addDays, daysInMonth, parseIsoDate, toIsoDate, type IsoDate } from './period';

export type RenewalCadence = 'weekly' | 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface RenewalSchedule {
  /** Day of month the subscription bills on, 1 to 31. Ignored for weekly. */
  readonly anchorDay: number;
  readonly cadence: RenewalCadence;
  /** How many cadence units between renewals. Defaults to 1. */
  readonly intervalCount?: number;
}

const MONTHS_PER_CADENCE: Record<Exclude<RenewalCadence, 'weekly'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
};

/**
 * The renewal date following `from`.
 *
 * Always computed from the anchor day, never by incrementing the previous
 * date. That distinction is the whole point: a subscription anchored on the
 * 31st goes 31 Jan, 28 Feb, 31 Mar. Incrementing the previous date would clamp
 * it to 28 Feb and then leave it stuck on the 28th forever.
 */
export function nextRenewalOn(schedule: RenewalSchedule, from: IsoDate): IsoDate {
  const { anchorDay, cadence } = schedule;
  const intervalCount = schedule.intervalCount ?? 1;

  if (!Number.isInteger(anchorDay) || anchorDay < 1 || anchorDay > 31) {
    throw new Error(`Anchor day must be an integer between 1 and 31, received ${anchorDay}`);
  }
  if (!Number.isInteger(intervalCount) || intervalCount < 1) {
    throw new Error(`Interval count must be a positive integer, received ${intervalCount}`);
  }

  if (cadence === 'weekly') {
    return addDays(from, 7 * intervalCount);
  }

  const { year, month } = parseIsoDate(from);
  const monthsAhead = MONTHS_PER_CADENCE[cadence] * intervalCount;

  // Normalise to a zero-based month index so overflow past December carries.
  const targetIndex = year * 12 + (month - 1) + monthsAhead;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = (targetIndex % 12) + 1;

  // Clamp, rather than roll over into the next month.
  const day = Math.min(anchorDay, daysInMonth(targetYear, targetMonth));

  return toIsoDate(targetYear, targetMonth, day);
}

/** The next `count` renewal dates after `from`. */
export function upcomingRenewals(
  schedule: RenewalSchedule,
  from: IsoDate,
  count: number,
): IsoDate[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`Count must be a non-negative integer, received ${count}`);
  }

  const dates: IsoDate[] = [];
  let cursor = from;

  for (let i = 0; i < count; i += 1) {
    cursor = nextRenewalOn(schedule, cursor);
    dates.push(cursor);
  }

  return dates;
}
