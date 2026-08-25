import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { listHouseholdMembers } from './profiles';

const ANA = '11111111-1111-4111-8111-111111111111';
const BEN = '22222222-2222-4222-8222-222222222222';

/**
 * Two calls, two results.
 *
 * The repository has to issue them separately: `household_members` and
 * `profiles` both reference `auth.users` and have no foreign key between them,
 * so PostgREST cannot infer the relationship and a nested select fails.
 */
function fakeDb(members: unknown, profiles: unknown, error: { message: string } | null = null) {
  const tables: string[] = [];

  const builder = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(
          table === 'household_members'
            ? { data: members, error }
            : { data: profiles, error: null },
        ).then(resolve),
    };
    return chain;
  };

  const db = {
    from: vi.fn((table: string) => {
      tables.push(table);
      return builder(table);
    }),
  };

  return { db: db as unknown as Db, tables };
}

const members = [
  { user_id: ANA, role: 'owner', joined_at: '2026-01-01T00:00:00Z' },
  { user_id: BEN, role: 'adult', joined_at: '2026-02-01T00:00:00Z' },
];

const profiles = [
  { id: ANA, display_name: 'Ana' },
  { id: BEN, display_name: 'Ben' },
];

describe('listHouseholdMembers', () => {
  it('reads the roster and the names separately', async () => {
    const { db, tables } = fakeDb(members, profiles);

    await listHouseholdMembers(db);

    expect(tables).toContain('household_members');
    expect(tables).toContain('profiles');
  });

  it('joins the display name onto each member', async () => {
    const { db } = fakeDb(members, profiles);

    const roster = await listHouseholdMembers(db);

    expect(roster).toEqual([
      { userId: ANA, role: 'owner', displayName: 'Ana' },
      { userId: BEN, role: 'adult', displayName: 'Ben' },
    ]);
  });

  // A profile row can be missing — the select policy shows profiles only for
  // active members, so a removed one leaves a gap. An expense still has to
  // render with something in the author slot.
  it('falls back to a placeholder when a name is missing', async () => {
    const { db } = fakeDb(members, [{ id: ANA, display_name: 'Ana' }]);

    const roster = await listHouseholdMembers(db);

    expect(roster[1]).toEqual({ userId: BEN, role: 'adult', displayName: 'Member' });
  });

  it('returns an empty roster rather than null', async () => {
    const { db } = fakeDb(null, null);

    await expect(listHouseholdMembers(db)).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb(null, null, { message: 'JWT expired' });

    await expect(listHouseholdMembers(db)).rejects.toThrow('JWT expired');
  });
});
