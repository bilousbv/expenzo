import { z } from 'zod';

import { isIsoDate } from '../period';

/** Uppercase ISO 4217. Lowercase is rejected so stored values are canonical. */
export const currencyCodeSchema = z
  .string()
  .regex(/^[A-Z]{3}$/, 'Currency must be a three-letter uppercase ISO code');

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted YYYY-MM-DD')
  .refine(isIsoDate, 'Not a real calendar date');

export const uuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Must be a UUID');

export const visibilitySchema = z.enum(['personal', 'shared']);

/** Blank strings become absent, so the database stores NULL rather than ''. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

export const createExpenseInput = z.object({
  amountMinor: z
    .number()
    .int('Amount must be a whole number of minor units')
    .positive('Amount must be greater than zero'),
  currency: currencyCodeSchema,
  occurredOn: isoDateSchema,
  visibility: visibilitySchema.default('shared'),
  categoryId: uuidSchema.optional(),
  merchant: optionalText,
  note: optionalText,
});

/**
 * The shape a caller supplies, not the shape parsing produces.
 *
 * `z.infer` would give the output: visibility already defaulted, and merchant
 * present but possibly undefined. Callers hold neither, so the input type is
 * the honest one for a function signature. Repositories work with the parsed
 * value, whose type is inferred at the parse call.
 */
export type CreateExpenseInput = z.input<typeof createExpenseInput>;

export const updateExpenseInput = createExpenseInput.partial().extend({
  id: uuidSchema,
});

export type UpdateExpenseInput = z.input<typeof updateExpenseInput>;

export const expenseScopeSchema = z.enum(['all', 'personal', 'shared']);

export const expenseFilter = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    categoryId: uuidSchema.optional(),
    memberId: uuidSchema.optional(),
    scope: expenseScopeSchema.default('all'),
  })
  .refine((filter) => !filter.from || !filter.to || filter.from <= filter.to, {
    message: 'Range end must not precede its start',
    path: ['to'],
  });

export type ExpenseFilter = z.input<typeof expenseFilter>;
