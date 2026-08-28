import { personDisplayName, type UpdateProfileInput } from '@expenzo/domain';

import type { Database, Db } from '../types';

type MemberRole = Database['public']['Enums']['member_role'];

/**
 * One string literal, not a concatenation: PostgREST infers the row type by
 * parsing this as a type, and anything built with `+` widens to
 * `GenericStringError[]`.
 */
const PROFILE_COLUMNS = 'id, first_name, last_name, display_name, display_currency';

export interface ProfileRow {
  readonly id: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  /** What the signup trigger derived from the address, kept as the fallback. */
  readonly displayName: string | null;
  /** Null means the household's own currency. */
  readonly displayCurrency: string | null;
}

export interface HouseholdMember {
  userId: string;
  role: MemberRole;
  displayName: string;
}

function toProfile(row: {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  display_currency: string | null;
}): ProfileRow {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    displayName: row.display_name,
    displayCurrency: row.display_currency,
  };
}

/**
 * The caller's own profile.
 *
 * maybeSingle rather than single: the row is created by a trigger at signup,
 * but a session can outlive it — a deleted account with a live token — and a
 * settings screen has to render rather than throw.
 */
export async function getMyProfile(db: Db, userId: string): Promise<ProfileRow | null> {
  const { data, error } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return data ? toProfile(data) : null;
}

/**
 * Saves what a member changed about themselves.
 *
 * Only the fields actually supplied are written, and null is one of them:
 * clearing a display currency is how a member goes back to reading totals in
 * the household's own money, and dropping nulls alongside undefined would make
 * that impossible to say.
 *
 * The update policy already scopes this to the caller's own row. The filter is
 * here as well because without it this is an unbounded update statement, and a
 * policy is the wrong thing to be relying on for that.
 */
export async function updateMyProfile(
  db: Db,
  userId: string,
  input: UpdateProfileInput,
): Promise<ProfileRow> {
  const patch: Database['public']['Tables']['profiles']['Update'] = {};

  if ('firstName' in input) patch.first_name = input.firstName ?? null;
  if ('lastName' in input) patch.last_name = input.lastName ?? null;
  if ('displayCurrency' in input) patch.display_currency = input.displayCurrency ?? null;

  const { data, error } = await db
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error(error.message);

  return toProfile(data);
}

/**
 * The household roster, with names attached.
 *
 * Two queries rather than a nested select: `household_members` and `profiles`
 * both reference `auth.users` and have no foreign key between them, so
 * PostgREST cannot infer the relationship. Adding one purely to satisfy a join
 * would be schema shaped around a query.
 *
 * Row-level security scopes both to the caller's household, so neither needs a
 * household filter of its own.
 */
export async function listHouseholdMembers(db: Db): Promise<HouseholdMember[]> {
  const [{ data: members, error }, { data: profiles }] = await Promise.all([
    db
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('status', 'active')
      .order('joined_at'),
    db.from('profiles').select('id, first_name, last_name, display_name'),
  ]);

  if (error) throw new Error(error.message);

  const nameFor = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      personDisplayName({
        firstName: profile.first_name,
        lastName: profile.last_name,
        displayName: profile.display_name,
      }),
    ]),
  );

  return (members ?? []).map((member) => ({
    userId: member.user_id,
    role: member.role,
    // A profile can be missing: the policy exposes profiles only for active
    // members, so a removed one leaves a gap. An expense still has to render
    // with something in the author slot.
    displayName: nameFor.get(member.user_id) ?? 'Member',
  }));
}
