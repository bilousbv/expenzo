import type { Database, Db } from '../types';

type MemberRole = Database['public']['Enums']['member_role'];

export interface HouseholdMember {
  userId: string;
  role: MemberRole;
  displayName: string;
}

/**
 * The household roster, with display names attached.
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
    db.from('profiles').select('id, display_name'),
  ]);

  if (error) throw new Error(error.message);

  const nameFor = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  return (members ?? []).map((member) => ({
    userId: member.user_id,
    role: member.role,
    // A profile can be missing: the policy exposes profiles only for active
    // members, so a removed one leaves a gap. An expense still has to render
    // with something in the author slot.
    displayName: nameFor.get(member.user_id) ?? 'Member',
  }));
}
