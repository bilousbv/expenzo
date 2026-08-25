import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { getCurrentHousehold } from './households';

function fakeDb(result: { data: unknown; error: { message: string } | null }) {
  const columns: string[] = [];

  const builder = {
    select(selection: string) {
      columns.push(selection);
      return builder;
    },
    maybeSingle: () => Promise.resolve(result),
  };

  const db = { from: vi.fn(() => builder) };

  return { db: db as unknown as Db, columns };
}

const household = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ana',
  base_currency: 'EUR',
  timezone: 'Europe/Madrid',
};

describe('getCurrentHousehold', () => {
  // One household per user, and the households policy already limits the table
  // to that one row, so this needs no filter at all.
  it('reads the single visible household', async () => {
    const { db } = fakeDb({ data: household, error: null });

    await expect(getCurrentHousehold(db)).resolves.toEqual(household);
  });

  it('asks for the columns the app actually uses', async () => {
    const { db, columns } = fakeDb({ data: household, error: null });

    await getCurrentHousehold(db);

    expect(columns[0]).toContain('base_currency');
    expect(columns[0]).toContain('timezone');
  });

  // maybeSingle rather than single: a user whose signup trigger has not yet
  // committed has no household, and that is a null, not an error.
  it('returns null when there is no household yet', async () => {
    const { db } = fakeDb({ data: null, error: null });

    await expect(getCurrentHousehold(db)).resolves.toBeNull();
  });

  it('throws the database message', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'JWT expired' } });

    await expect(getCurrentHousehold(db)).rejects.toThrow('JWT expired');
  });
});
