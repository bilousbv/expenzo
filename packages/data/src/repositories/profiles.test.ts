import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { getMyProfile, listHouseholdMembers, updateMyProfile } from './profiles';

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

/** A single-row read or write, recording the payload it was handed. */
function fakeProfileDb(row: unknown, error: { message: string } | null = null) {
  const updates: unknown[] = [];
  const filters: Array<[string, unknown]> = [];

  const chain: Record<string, unknown> = {
    select: () => chain,
    update: (payload: unknown) => {
      updates.push(payload);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      filters.push([column, value]);
      return chain;
    },
    maybeSingle: () => Promise.resolve({ data: row, error }),
    single: () => Promise.resolve({ data: row, error }),
  };

  return { db: { from: vi.fn(() => chain) } as unknown as Db, updates, filters };
}

describe('getMyProfile', () => {
  it('reads the caller row and names its fields in the app', async () => {
    const { db, filters } = fakeProfileDb({
      id: ANA,
      first_name: 'Ana',
      last_name: 'Petrenko',
      display_name: 'ana',
      display_currency: 'UAH',
    });

    await expect(getMyProfile(db, ANA)).resolves.toEqual({
      id: ANA,
      firstName: 'Ana',
      lastName: 'Petrenko',
      displayName: 'ana',
      displayCurrency: 'UAH',
    });
    expect(filters).toContainEqual(['id', ANA]);
  });

  // The row is created by a trigger on signup, but a session can outlive the
  // profile — a deleted account with a live token — and a settings screen has
  // to render rather than throw.
  it('returns null when there is no profile yet', async () => {
    const { db } = fakeProfileDb(null);

    await expect(getMyProfile(db, ANA)).resolves.toBeNull();
  });

  it('throws the database message', async () => {
    const { db } = fakeProfileDb(null, { message: 'JWT expired' });

    await expect(getMyProfile(db, ANA)).rejects.toThrow('JWT expired');
  });
});

describe('updateMyProfile', () => {
  it('writes only the fields it was given', async () => {
    const { db, updates } = fakeProfileDb({
      id: ANA,
      first_name: 'Anna',
      last_name: null,
      display_name: 'ana',
      display_currency: null,
    });

    await updateMyProfile(db, ANA, { firstName: 'Anna' });

    expect(updates).toEqual([{ first_name: 'Anna' }]);
  });

  /*
   * Null is a value here, not an absence: it is how a member says "show me the
   * household's currency". Dropping it alongside undefined would make the
   * choice impossible to undo.
   */
  it('writes a cleared display currency as null', async () => {
    const { db, updates } = fakeProfileDb({
      id: ANA,
      first_name: 'Ana',
      last_name: null,
      display_name: 'ana',
      display_currency: null,
    });

    await updateMyProfile(db, ANA, { displayCurrency: null });

    expect(updates).toEqual([{ display_currency: null }]);
  });

  // The update policy is scoped to the caller's own row, but a missing filter
  // would still be an unbounded update statement against the whole table.
  it('scopes the write to the caller', async () => {
    const { db, filters } = fakeProfileDb({
      id: ANA,
      first_name: 'Ana',
      last_name: null,
      display_name: 'ana',
      display_currency: null,
    });

    await updateMyProfile(db, ANA, { firstName: 'Ana' });

    expect(filters).toEqual([['id', ANA]]);
  });

  it('throws the database message', async () => {
    const { db } = fakeProfileDb(null, { message: 'currency CLP is not quoted' });

    await expect(updateMyProfile(db, ANA, { displayCurrency: 'CLP' })).rejects.toThrow(
      'currency CLP is not quoted',
    );
  });
});

describe('listHouseholdMembers, once people have names', () => {
  it('prefers the name a member typed over the one signup derived', async () => {
    const { db } = fakeDb(members, [
      { id: ANA, display_name: 'ana.p', first_name: 'Ana', last_name: 'Petrenko' },
      { id: BEN, display_name: 'ben', first_name: null, last_name: null },
    ]);

    const roster = await listHouseholdMembers(db);

    expect(roster.map((member) => member.displayName)).toEqual(['Ana Petrenko', 'ben']);
  });
});
