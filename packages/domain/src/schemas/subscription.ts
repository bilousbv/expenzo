import { z } from 'zod';

import { parseIsoDate, type IsoDate } from '../period';
import { currencyCodeSchema, isoDateSchema, uuidSchema } from './expense';

/**
 * How often a subscription bills.
 *
 * Mirrors `RenewalCadence` in ../renewal.ts, which owns the arithmetic. Kept as
 * its own enum here rather than imported as a type so zod can validate it.
 */
export const subscriptionCadenceSchema = z.enum([
  'weekly',
  'monthly',
  'quarterly',
  'semiannual',
  'yearly',
]);

export type SubscriptionCadence = z.infer<typeof subscriptionCadenceSchema>;

/**
 * Cancelled rather than deleted.
 *
 * A subscription that has been paid for months is history, and history that
 * disappears takes the totals it contributed to with it. Cancelling stops the
 * renewals without pretending it never existed.
 */
export const subscriptionStatusSchema = z.enum(['active', 'cancelled']);

export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

/**
 * The day of the month a subscription bills on, taken from the day it started.
 *
 * Derived rather than asked for. Nobody thinks of a subscription as "anchored
 * on the 12th" — they know it started on 12 January, and asking twice for the
 * same fact is how the two come to disagree.
 *
 * 31 is a legitimate anchor even though most months lack that day. It is an
 * anchor and not a date; `nextRenewalOn` clamps it per month, which is exactly
 * why the anchor is stored rather than the last billing date.
 */
export function anchorDayFor(startedOn: string): number {
  return parseIsoDate(startedOn as IsoDate).day;
}

export const createSubscriptionInput = z.object({
  /** The catalogue entry this came from, when it came from one. */
  serviceId: uuidSchema.optional(),
  name: z
    .string()
    .trim()
    .min(1, 'validation.subscription.nameRequired')
    .max(120, 'validation.subscription.nameTooLong'),
  amountMinor: z.number().int('validation.amount.integer').positive('validation.amount.positive'),
  currency: currencyCodeSchema,
  cadence: subscriptionCadenceSchema,
  intervalCount: z
    .number()
    .int('validation.subscription.intervalCount')
    .min(1, 'validation.subscription.intervalCount')
    .default(1),
  anchorDay: z
    .number()
    .int('validation.subscription.anchorDay')
    .min(1, 'validation.subscription.anchorDay')
    .max(31, 'validation.subscription.anchorDay'),
  startedOn: isoDateSchema,
  categoryId: uuidSchema.optional(),
  status: subscriptionStatusSchema.default('active'),
  notes: z
    .string()
    .optional()
    .transform((value) => {
      const trimmed = value?.trim();
      return trimmed ? trimmed : undefined;
    }),
});

export type CreateSubscriptionInput = z.input<typeof createSubscriptionInput>;

export const updateSubscriptionInput = createSubscriptionInput.partial().extend({
  id: uuidSchema,
});

export type UpdateSubscriptionInput = z.input<typeof updateSubscriptionInput>;
