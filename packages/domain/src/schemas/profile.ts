import { z } from 'zod';

import { currencyCodeSchema } from './expense';

/**
 * The part of an account a person fills in themselves.
 *
 * Names are display data, not identity: the account is the email address, and
 * two members of a household may well be called the same thing. Nothing here is
 * unique and nothing here is required.
 */

/** Long enough for any real name, short enough to catch a pasted paragraph. */
const NAME_MAX_LENGTH = 80;

/**
 * A name as typed.
 *
 * No character rule beyond emptiness: names are not ASCII, they carry
 * apostrophes, hyphens and spaces, and any pattern tight enough to be worth
 * writing would reject somebody real.
 */
export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'validation.name.required')
  .max(NAME_MAX_LENGTH, 'validation.name.tooLong');

/**
 * A name being edited, where clearing the box is a legitimate thing to do.
 *
 * An emptied field becomes null rather than an empty string, so the database
 * holds an absence instead of a value that renders as a gap.
 */
const editableName = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  .refine((value) => value === null || value.length <= NAME_MAX_LENGTH, 'validation.name.tooLong')
  .optional();

/**
 * What a member may change about themselves.
 *
 * `displayCurrency` null means "whatever the household uses", which is not the
 * same as omitting the field — that changes nothing. Collapsing the two would
 * leave a member unable to undo a currency choice.
 */
export const updateProfileInput = z.object({
  firstName: editableName,
  lastName: editableName,
  displayCurrency: currencyCodeSchema.nullable().optional(),
});

export type UpdateProfileInput = z.input<typeof updateProfileInput>;

export interface PersonNames {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  /** What the signup trigger derived from the address, for accounts with no form. */
  readonly displayName?: string | null;
}

/**
 * The one place a person's name is assembled, so every screen agrees.
 *
 * Returns null rather than a placeholder: this package holds no prose, and only
 * the caller knows what language to apologise in.
 */
export function personDisplayName(person: PersonNames): string | null {
  const parts = [person.firstName, person.lastName]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  if (parts.length > 0) return parts.join(' ');

  // Signing in with a magic link never asks for a name, so those accounts have
  // only what the trigger derived from the address. It is what they are called.
  const derived = person.displayName?.trim();

  return derived ? derived : null;
}
