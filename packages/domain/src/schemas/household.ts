import { z } from 'zod';

import { emailSchema } from './auth';

/**
 * Who is in a household and what they may do in it.
 *
 * The rules here are the same ones the database enforces in
 * `create_household_invitation`, `set_member_role` and
 * `remove_household_member`. They exist a second time on the client so a
 * button that cannot work is not offered — never as the boundary itself, which
 * is row-level security and those functions.
 */

/** Mirrors `public.member_role`. */
export const memberRoleSchema = z.enum(['owner', 'adult', 'child', 'viewer']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

/**
 * What an invitation may offer.
 *
 * A household has exactly one owner and it is recorded on
 * `households.owner_id`, so that role is not something an invitation can hand
 * out. `viewer` stays a role the schema knows and no screen offers: a family
 * member who may look but not record is a real case, and not one anybody has
 * asked for yet.
 */
export const invitableRoleSchema = z.enum(['adult', 'child']);
export type InvitableRole = z.infer<typeof invitableRoleSchema>;

/**
 * An invitation as the form collects it.
 *
 * The address is lowercased by `emailSchema`, matching how GoTrue stores one —
 * an invitation addressed to Ana@Example.com has to be redeemable by the
 * account that registered as ana@example.com.
 */
export const inviteInput = z.object({
  email: emailSchema,
  role: invitableRoleSchema.default('adult'),
});

export type InviteInput = z.infer<typeof inviteInput>;

/**
 * Whether this role may invite people, change a role or remove a member.
 *
 * The same pair the expense policies already use for editing somebody else's
 * row: a child records their own spending and administers nothing.
 */
export function canManageMembers(role: MemberRole | undefined): boolean {
  return role === 'owner' || role === 'adult';
}

/** What opening an invitation link should do. */
export type InviteMode = 'accept' | 'signIn' | 'register' | 'invalid';

/**
 * Which of the four it is.
 *
 * Written once and used by both platforms, because getting it wrong is not
 * visible in a screenshot: sending an existing account to the registration
 * form fails on "User already registered", and sending a new one to sign in
 * fails on credentials they have never set.
 */
export function inviteMode(options: {
  /** Whether the token previewed as anything at all. */
  known: boolean;
  signedIn: boolean;
  /** Whether the invited address already has an account. */
  accountExists: boolean;
}): InviteMode {
  if (!options.known) return 'invalid';
  if (options.signedIn) return 'accept';

  return options.accountExists ? 'signIn' : 'register';
}

/**
 * Whether `actor` may remove a member holding `target`.
 *
 * The owner is never removable. Their membership is what `households.owner_id`
 * points at, so dropping it would leave a household with rows in it and nobody
 * able to administer them.
 */
export function canRemoveMember(actor: MemberRole | undefined, target: MemberRole): boolean {
  return canManageMembers(actor) && target !== 'owner';
}
