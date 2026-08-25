import { z } from 'zod';

import { uuidSchema } from './expense';

/**
 * Weekly and yearly cost nothing to carry and are expensive to retrofit, so the
 * schema knows all three even while the UI offers only monthly.
 */
export const limitPeriodSchema = z.enum(['weekly', 'monthly', 'yearly']);

export type LimitPeriod = z.infer<typeof limitPeriodSchema>;

export const createLimitInput = z.object({
  /** Absent means the household-wide limit rather than one category's. */
  categoryId: uuidSchema.optional(),
  amountMinor: z
    .number()
    .int('Amount must be a whole number of minor units')
    // A limit of zero is not a limit; it is a ban, and the check constraint on
    // the column says the same.
    .positive('A limit has to be greater than zero'),
  period: limitPeriodSchema.default('monthly'),
});

export type CreateLimitInput = z.input<typeof createLimitInput>;

export const updateLimitInput = z.object({
  id: uuidSchema,
  amountMinor: z.number().int().positive('A limit has to be greater than zero'),
});

export type UpdateLimitInput = z.input<typeof updateLimitInput>;

export interface LimitProgress {
  spentMinor: number;
  limitMinor: number | null;
  /** Spend as a fraction of the limit, or null when there is no limit set. */
  ratio: number | null;
  exceeded: boolean;
}

/**
 * How far through a limit a given amount of spending is.
 *
 * Returns a ratio rather than a percentage so the caller decides on rounding —
 * a bar that reads 100% while still under is worse than one that reads 99%.
 */
export function limitProgress(spentMinor: number, limitMinor: number | null): LimitProgress {
  if (limitMinor === null || limitMinor <= 0) {
    return { spentMinor, limitMinor: null, ratio: null, exceeded: false };
  }

  return {
    spentMinor,
    limitMinor,
    ratio: spentMinor / limitMinor,
    // Strictly greater: spending exactly the limit is staying within it.
    exceeded: spentMinor > limitMinor,
  };
}
