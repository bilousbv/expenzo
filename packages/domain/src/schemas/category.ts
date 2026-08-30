import { z } from 'zod';

import { slugify } from '../slug';
import { uuidSchema } from './expense';

/** Six-digit hex only. Three-digit and named colours would store two spellings
 *  of the same colour, and the swatch UI offers exactly this form. */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'validation.category.colourInvalid')
  .transform((value) => value.toLowerCase());

/** Blank strings become absent, so the database stores NULL rather than ''. */
const optionalText = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
  });

const categoryName = z
  .string()
  .trim()
  .min(1, 'validation.category.nameRequired')
  .max(64, 'validation.category.nameTooLong')
  // A name of only emoji or punctuation is not blank, but it produces no slug —
  // and the slug is what the unique index is built on. Catching it here means
  // the user gets a sentence rather than a constraint name.
  .refine((value) => slugify(value).length > 0, 'validation.category.nameNeedsCharacter');

/**
 * Which list a category belongs to.
 *
 * "Streaming" answers "what do we pay for every month"; "Groceries" answers
 * "what did we spend money on last week". They are two taxonomies, and mixing
 * them into one list made each of them harder to read.
 */
export const categoryKindSchema = z.enum(['expense', 'subscription']);

export type CategoryKind = z.infer<typeof categoryKindSchema>;

export const createCategoryInput = z.object({
  name: categoryName,
  // Defaulted, not required: everything that existed before the split was an
  // expense category, and every caller that has not been told about kinds
  // still means one.
  kind: categoryKindSchema.default('expense'),
  icon: optionalText,
  color: hexColorSchema.optional(),
  parentId: uuidSchema.optional(),
  // Seeded system categories occupy 10–999 in steps of ten. Starting custom
  // ones at 500 drops them into the middle rather than above everything.
  sortOrder: z.number().int('validation.category.sortOrderInteger').min(0).default(500),
});

/**
 * The shape a caller supplies, not the shape parsing produces.
 *
 * `z.infer` would give the output: sortOrder already defaulted and icon present
 * but possibly undefined. Callers hold neither, so the input type is the honest
 * one for a function signature. Repositories work with the parsed value, whose
 * type is inferred at the parse call.
 */
export type CreateCategoryInput = z.input<typeof createCategoryInput>;

/**
 * Note the absence of `slug`. It is derived from the name once, at creation,
 * and never changes: a household that renames "Coffee" to "Groceries" would
 * otherwise collide with a slug it never chose, and nothing references the slug
 * anyway — expenses point at the id.
 */
export const updateCategoryInput = z
  .object({
    name: categoryName,
    icon: optionalText,
    color: hexColorSchema,
    parentId: uuidSchema.nullable(),
    sortOrder: z.number().int().min(0),
  })
  .partial()
  .extend({ id: uuidSchema });

export type UpdateCategoryInput = z.input<typeof updateCategoryInput>;
