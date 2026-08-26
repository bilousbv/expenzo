import type { Db } from '@expenzo/data';
import { describe, expect, it, vi } from 'vitest';

import { ECB_DAILY_URL, isAuthorizedSync, syncFxRates } from './fx-sync';

const ECB_DAILY = `<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope>
  <Cube>
    <Cube time='2026-08-25'>
      <Cube currency='USD' rate='1.1642'/>
      <Cube currency='GBP' rate='0.86215'/>
    </Cube>
  </Cube>
</gesmes:Envelope>`;

function fakeDb() {
  const upserts: unknown[] = [];
  const db = {
    from: () => ({
      upsert: (rows: unknown) => {
        upserts.push(rows);
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };

  return { db: db as unknown as Db, upserts };
}

function respondWith(body: string, ok = true, status = 200) {
  return vi.fn(() => Promise.resolve({ ok, status, text: () => Promise.resolve(body) }));
}

describe('syncFxRates', () => {
  it('reads the European Central Bank daily feed', async () => {
    const { db } = fakeDb();
    const fetchImpl = respondWith(ECB_DAILY);

    await syncFxRates(db, fetchImpl as unknown as typeof fetch);

    expect(fetchImpl).toHaveBeenCalledWith(ECB_DAILY_URL, expect.anything());
  });

  it('stores every rate it published, plus the euro itself', async () => {
    const { db, upserts } = fakeDb();

    await syncFxRates(db, respondWith(ECB_DAILY) as unknown as typeof fetch);

    expect(upserts[0]).toHaveLength(3);
  });

  it('reports the date the rates were published for', async () => {
    const { db } = fakeDb();

    await expect(
      syncFxRates(db, respondWith(ECB_DAILY) as unknown as typeof fetch),
    ).resolves.toEqual({
      asOf: '2026-08-25',
      quoted: 3,
    });
  });

  // A 503 that produced an empty rate table would leave every foreign expense
  // unrecordable, and the cause would be a status code nobody logged.
  it('throws on an unsuccessful response rather than parsing the error page', async () => {
    const { db } = fakeDb();

    await expect(
      syncFxRates(
        db,
        respondWith('<html>maintenance</html>', false, 503) as unknown as typeof fetch,
      ),
    ).rejects.toThrow(/503/);
  });

  it('throws when the body is not the feed', async () => {
    const { db } = fakeDb();

    await expect(
      syncFxRates(db, respondWith('<html>hello</html>') as unknown as typeof fetch),
    ).rejects.toThrow(/date/i);
  });
});

describe('isAuthorizedSync', () => {
  it('accepts the configured secret', () => {
    expect(isAuthorizedSync('Bearer s3cret', 's3cret')).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(isAuthorizedSync('Bearer wrong', 's3cret')).toBe(false);
  });

  it('rejects one of a different length', () => {
    expect(isAuthorizedSync('Bearer s3', 's3cret')).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(isAuthorizedSync(null, 's3cret')).toBe(false);
  });

  it('rejects a header that is not a bearer token', () => {
    expect(isAuthorizedSync('s3cret', 's3cret')).toBe(false);
  });

  // An unset secret must not mean "no check". A route that syncs for anyone who
  // asks is a route anyone can use to fill the rate table.
  it('rejects everything when no secret is configured', () => {
    expect(isAuthorizedSync('Bearer ', '')).toBe(false);
    expect(isAuthorizedSync('Bearer anything', '')).toBe(false);
  });
});
