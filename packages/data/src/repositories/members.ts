import type { MemberRole } from '@expenzo/domain';

import type { Db } from '../types';

/**
 * Changing somebody's membership.
 *
 * `household_members` has no client-writable policy at all — that is what stops
 * anyone writing themselves into a household — so both of these go through a
 * SECURITY DEFINER function which states its own rules: only an owner or adult
 * may call them, and neither will touch the owner's own row.
 */

export async function setMemberRole(db: Db, member: string, role: MemberRole): Promise<void> {
  const { error } = await db.rpc('set_member_role', { member, new_role: role });

  if (error) throw new Error(error.message);
}

export async function removeMember(db: Db, member: string): Promise<void> {
  const { error } = await db.rpc('remove_household_member', { member });

  if (error) throw new Error(error.message);
}
