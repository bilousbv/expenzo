import {
  addDays,
  daysInMonth,
  parseIsoDate,
  toIsoDate,
  type DateRange,
  type IsoDate,
} from './period';

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

/** How many days the upcoming-renewals card looks ahead. */
export const RENEWAL_WINDOW_DAYS = 7;

/**
 * The window the upcoming-renewals card asks for.
 *
 * Both ends inclusive. Today counts, because a charge is not history until the
 * merchant takes it; and the far end is a full week out rather than six days,
 * because a weekly subscription renews exactly a week from the last charge and
 * an exclusive bound would keep it off the card permanently.
 */
export function renewalWindow(today: IsoDate, days: number = RENEWAL_WINDOW_DAYS): DateRange {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error(`A renewal window must be a positive whole number of days, received ${days}`);
  }

  return { start: today, end: addDays(today, days) };
}

/**
 * Whole calendar days from one date to another; negative once `to` is past.
 *
 * Counted on the calendar rather than in elapsed hours, so a span containing a
 * clock change is still a whole number of days.
 */
export function daysUntil(from: IsoDate, to: IsoDate): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);

  const startUtc = Date.UTC(start.year, start.month - 1, start.day);
  const endUtc = Date.UTC(end.year, end.month - 1, end.day);

  return Math.round((endUtc - startUtc) / 86_400_000);
}

/**
 * The day a free trial runs out, counted from the day it started.
 *
 * Mirrors the `trial_ends_on` generated column, and must keep agreeing with
 * it: the date shown before saving has to be the date stored.
 */
export function trialEndsOn(startedOn: IsoDate, trialDays: number): IsoDate {
  if (!Number.isInteger(trialDays) || trialDays < 1) {
    throw new Error(`A trial must be a positive whole number of days, received ${trialDays}`);
  }

  return addDays(startedOn, trialDays);
}

/**
 * The day money starts moving: the end of the trial, or the start date when
 * there is no trial.
 *
 * This is what the billing schedule is anchored to, mirroring the `coalesce`
 * in `app.set_subscription_next_renewal`. Anchoring to the sign-up date
 * instead would bill a 30-day trial started on the 1st on the 1st, a month
 * before the merchant does.
 */
export function billingStartsOn(startedOn: IsoDate, trialDays?: number): IsoDate {
  return trialDays === undefined ? startedOn : trialEndsOn(startedOn, trialDays);
}
