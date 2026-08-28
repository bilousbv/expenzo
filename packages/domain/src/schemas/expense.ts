import { z } from 'zod';

import { isIsoDate } from '../period';

/** Uppercase ISO 4217. Lowercase is rejected so stored values are canonical. */
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'validation.currency.invalid');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'validation.date.format')
  .refine(isIsoDate, 'validation.date.unreal');

export const uuidSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'validation.uuid.invalid',
  );

/** Blank strings become absent, so the database stores NULL rather than ''. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

/**
 * Spending or income. A direction column rather than a signed amount: carrying
 * both a sign and a direction invites rows where the two disagree, and the
 * amount column is constrained positive.
 */
export const expenseDirectionSchema = z.enum(['spend', 'income']);

export const createExpenseInput = z.object({
  direction: expenseDirectionSchema.default('spend'),
  amountMinor: z.number().int('validation.amount.integer').positive('validation.amount.positive'),
  currency: currencyCodeSchema,
  occurredOn: isoDateSchema,
  categoryId: uuidSchema.optional(),
  merchant: optionalText,
  note: optionalText,
});

/**
 * The shape a caller supplies, not the shape parsing produces.
 *
 * `z.infer` would give the output, with merchant present but possibly
 * undefined and every blank string already dropped. Callers hold neither of
 * those, so the input type is
 * the honest one for a function signature. Repositories work with the parsed
 * value, whose type is inferred at the parse call.
 */
export type CreateExpenseInput = z.input<typeof createExpenseInput>;

export const updateExpenseInput = createExpenseInput.partial().extend({
  id: uuidSchema,
});

export type UpdateExpenseInput = z.input<typeof updateExpenseInput>;

/**
 * `memberId` is the author filter. There is no scope any more: every member
 * sees every expense, so the only meaningful narrowing is "whose".
 */
export const expenseFilter = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    categoryId: uuidSchema.optional(),
    /**
     * The expenses with no category at all.
     *
     * Its own flag rather than a sentinel categoryId, because that column is a
     * uuid and any value standing in for "none" would be a uuid that could one
     * day belong to a real category.
     */
    uncategorised: z.boolean().optional(),
    memberId: uuidSchema.optional(),
  })
  .refine((filter) => !filter.from || !filter.to || filter.from <= filter.to, {
    message: 'validation.date.rangeReversed',
    path: ['to'],
  })
  // Asking for both is a caller that has not decided what it wants, and
  // answering either way would be a guess.
  .refine((filter) => !(filter.categoryId && filter.uncategorised), {
    message: 'validation.filter.categoryConflict',
    path: ['uncategorised'],
  });

export type ExpenseFilter = z.input<typeof expenseFilter>;

/**
 * The URL segment standing in for "expenses with no category at all".
 *
 * A word rather than a sentinel id, because the column is a uuid and any value
 * chosen to mean "none" could one day belong to a real category.
 */
export const UNCATEGORISED = 'uncategorised';

/**
 * Turns a category route segment into a filter.
 *
 * Both platforms link to the same shape of page, so both need the same reading
 * of that segment — and the reading is not obvious enough to be worth writing
 * twice.
 */
export function categoryFilter(
  segment: string,
): Pick<ExpenseFilter, 'categoryId' | 'uncategorised'> {
  const none = segment === UNCATEGORISED;

  return {
    categoryId: none ? undefined : segment,
    uncategorised: none ? true : undefined,
  };
}
