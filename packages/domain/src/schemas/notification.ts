import { z } from 'zod';

import { uuidSchema } from './expense';

/**
 * The kinds of notification the product will send.
 *
 * All three exist in the database enum already, because Postgres refuses to use
 * an enum value in the transaction that added it and a value added later costs
 * a migration of its own. Only `limit_exceeded` is produced so far, which is
 * why the preferences screen offers one switch rather than three: a control for
 * something that cannot happen yet is a promise the app does not keep.
 */
export const NOTIFICATION_KINDS = ['limit_exceeded', 'renewal_upcoming', 'trial_ending'] as const;

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);

export type NotificationKind = z.infer<typeof notificationKindSchema>;

/** The kinds a member can actually turn off today. */
export const SETTABLE_KINDS = ['limit_exceeded'] as const;

export const deliveryStatusSchema = z.enum(['sent', 'suppressed', 'failed']);

export type DeliveryStatus = z.infer<typeof deliveryStatusSchema>;

/**
 * One limit that a single expense pushed a household past.
 *
 * `categoryId` is null for the household-wide limit, which is the same
 * distinction `spending_limits.category_id` carries — there is no sentinel id,
 * because any uuid chosen to mean "everything" could one day be a category.
 */
export const breachedLimitSchema = z.object({
  limit_id: uuidSchema,
  category_id: uuidSchema.nullable(),
  amount_minor: z.number().int(),
  spent_minor: z.number().int(),
  period_start: z.string(),
  period_end: z.string(),
});

export type BreachedLimit = z.infer<typeof breachedLimitSchema>;

/**
 * The payload of a `limit_exceeded` job.
 *
 * Parsed rather than trusted. It is written by a trigger and read months later
 * by a screen, so the shape has one definition and a payload that predates a
 * change fails here rather than rendering as "undefined of undefined".
 *
 * One notification can name several limits: a single purchase that takes a
 * category past its limit and the household past its overall limit is one
 * event, and it is announced as one.
 */
export const limitBreachPayload = z.object({
  limits: z.array(breachedLimitSchema).min(1),
});

export type LimitBreachPayload = z.infer<typeof limitBreachPayload>;

/**
 * Reads a job payload, or null when it is not one this version understands.
 *
 * Null rather than a throw: an unreadable notification should be skipped by
 * the list, not take the whole inbox down with it.
 */
export function parseLimitBreach(payload: unknown): LimitBreachPayload | null {
  const parsed = limitBreachPayload.safeParse(payload);

  return parsed.success ? parsed.data : null;
}
