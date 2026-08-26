import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { listSupportedCurrencies, upsertEcbRates } from './fx';

const feed = {
  asOf: '2026-08-25',
  rates: { EUR: 1, USD: 1.1642, JPY: 171.35 },
};

/** Records what was written, and answers reads from a queue of responses. */
function fakeDb(responses: Array<{ data: unknown; error?: { message: string } | null }>) {
  const upserts: Array<{ rows: unknown; options: unknown }> = [];
  let read = 0;

  const builder = () => {
    const next = () => responses[read++] ?? { data: [], error: null };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      upsert: (rows: unknown, options: unknown) => {
        upserts.push({ rows, options });
        const response = next();
        return Promise.resolve({ data: response.data, error: response.error ?? null });
      },
      then: (resolve: (value: unknown) => unknown) => {
        const response = next();
        return Promise.resolve({ data: response.data, error: response.error ?? null }).then(
          resolve,
        );
      },
    };

    return chain;
  };

  return { db: { from: vi.fn(builder) } as unknown as Db, upserts };
}

describe('upsertEcbRates', () => {
  it('writes one row per quoted currency', async () => {
    const { db, upserts } = fakeDb([{ data: null }]);

    await upsertEcbRates(db, feed);

    expect(upserts[0]?.rows).toHaveLength(3);
  });

  // The feed is EUR-based, and the base is stored rather than assumed so a
  // second source with a different base needs no schema change.
  it('files every row under the euro at the published date', async () => {
    const { db, upserts } = fakeDb([{ data: null }]);

    await upsertEcbRates(db, feed);

    const rows = upserts[0]?.rows as Array<Record<string, unknown>>;

    expect(rows.every((row) => row.base === 'EUR' && row.as_of === '2026-08-25')).toBe(true);
    expect(rows).toContainEqual(
      expect.objectContaining({ quote: 'USD', rate: 1.1642, source: 'ecb' }),
    );
  });

  // EUR quotes itself at one so that a euro pair needs no special case in the
  // rate lookup.
  it('includes the euro quoting itself', async () => {
    const { db, upserts } = fakeDb([{ data: null }]);

    await upsertEcbRates(db, feed);

    expect(upserts[0]?.rows).toContainEqual(expect.objectContaining({ quote: 'EUR', rate: 1 }));
  });

  // Re-running the sync must be free. Without the conflict target a second run
  // on the same day raises a primary key violation and the job looks broken.
  it('upserts on the key rather than inserting', async () => {
    const { db, upserts } = fakeDb([{ data: null }]);

    await upsertEcbRates(db, feed);

    expect(upserts[0]?.options).toMatchObject({ onConflict: 'base,quote,as_of' });
  });

  it('reports what it wrote', async () => {
    const { db } = fakeDb([{ data: null }]);

    await expect(upsertEcbRates(db, feed)).resolves.toEqual({ asOf: '2026-08-25', quoted: 3 });
  });

  it('throws the database message', async () => {
    const { db } = fakeDb([{ data: null, error: { message: 'permission denied' } }]);

    await expect(upsertEcbRates(db, feed)).rejects.toThrow('permission denied');
  });
});

describe('listSupportedCurrencies', () => {
  it('offers the currencies quoted on the most recent publication', async () => {
    const { db } = fakeDb([
      { data: [{ as_of: '2026-08-25' }] },
      { data: [{ quote: 'USD' }, { quote: 'JPY' }, { quote: 'EUR' }] },
    ]);

    await expect(listSupportedCurrencies(db, 'USD')).resolves.toEqual(['EUR', 'JPY', 'USD']);
  });

  // The household's own currency needs no rate to convert, so it is always
  // offerable even if the feed has never quoted it.
  it('always includes the household currency', async () => {
    const { db } = fakeDb([
      { data: [{ as_of: '2026-08-25' }] },
      { data: [{ quote: 'EUR' }, { quote: 'USD' }] },
    ]);

    await expect(listSupportedCurrencies(db, 'CLP')).resolves.toEqual(['CLP', 'EUR', 'USD']);
  });

  // Before the first sync there is nothing in the table, and the entry form
  // still has to offer something rather than an empty dropdown.
  it('falls back to the household currency alone when no rates are on file', async () => {
    const { db } = fakeDb([{ data: [] }]);

    await expect(listSupportedCurrencies(db, 'USD')).resolves.toEqual(['USD']);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb([{ data: null, error: { message: 'JWT expired' } }]);

    await expect(listSupportedCurrencies(db, 'USD')).rejects.toThrow('JWT expired');
  });
});
