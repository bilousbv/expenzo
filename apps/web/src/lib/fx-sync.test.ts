import type { Db } from '@expenzo/data';
import { describe, expect, it, vi } from 'vitest';

import { ECB_DAILY_URL, isAuthorizedSync, NBU_DAILY_URL, syncFxRates } from './fx-sync';

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

const NBU_DAILY = JSON.stringify([
  { rate: 44.5445, cc: 'USD', exchangedate: '25.08.2026' },
  { rate: 51.8578, cc: 'EUR', exchangedate: '25.08.2026' },
  { rate: 0.27939, cc: 'JPY', exchangedate: '25.08.2026' },
]);

function respondWith(body: string, ok = true, status = 200) {
  return vi.fn(() => Promise.resolve({ ok, status, text: () => Promise.resolve(body) }));
}

/** Answers each feed with its own body, or with a failure for that one. */
function respondPerUrl(bodies: { ecb?: string; nbu?: string }) {
  return vi.fn((url: string) => {
    const body = url === NBU_DAILY_URL ? bodies.nbu : bodies.ecb;

    return Promise.resolve(
      body === undefined
        ? { ok: false, status: 503, text: () => Promise.resolve('down') }
        : { ok: true, status: 200, text: () => Promise.resolve(body) },
    );
  });
}

/** Every quote written, flattened across both upserts. */
function quotesFrom(upserts: unknown[]): Record<string, { rate: number; source: string }> {
  const seen: Record<string, { rate: number; source: string }> = {};

  for (const batch of upserts) {
    for (const row of batch as { quote: string; rate: number; source: string }[]) {
      seen[row.quote] = { rate: row.rate, source: row.source };
    }
  }

  return seen;
}

describe('syncFxRates, across both sources', () => {
  /**
   * The reason this source exists at all. The ECB publishes 29 currencies and
   * the hryvnia is not among them, which for an app whose default language is
   * Ukrainian is not a gap that can be left.
   */
  it('files the hryvnia, which the ECB does not quote', async () => {
    const { db, upserts } = fakeDb();

    await syncFxRates(
      db,
      respondPerUrl({ ecb: ECB_DAILY, nbu: NBU_DAILY }) as unknown as typeof fetch,
    );

    expect(quotesFrom(upserts).UAH?.rate).toBeCloseTo(51.8578, 4);
  });

  it('stores everything euro-based, whichever source quoted it', async () => {
    const { db, upserts } = fakeDb();

    await syncFxRates(
      db,
      respondPerUrl({ ecb: ECB_DAILY, nbu: NBU_DAILY }) as unknown as typeof fetch,
    );

    for (const batch of upserts) {
      for (const row of batch as { base: string }[]) {
        expect(row.base).toBe('EUR');
      }
    }
  });

  // Both quote the dollar. The ECB is the reference for euro pairs and is what
  // every other euro rate in the table came from, so it wins rather than
  // whichever source happened to be written second.
  it('prefers the ECB where the two overlap', async () => {
    const { db, upserts } = fakeDb();

    await syncFxRates(
      db,
      respondPerUrl({ ecb: ECB_DAILY, nbu: NBU_DAILY }) as unknown as typeof fetch,
    );

    expect(quotesFrom(upserts).USD?.source).toBe('ecb');
  });

  /**
   * Rates persist and the lookup already reaches back a week, so one feed
   * being down for a day is absorbed. Failing the whole sync would throw away
   * the source that did answer, which is strictly worse than a day-old rate.
   */
  it('files what it got when the hryvnia feed is down', async () => {
    const { db, upserts } = fakeDb();

    const result = await syncFxRates(
      db,
      respondPerUrl({ ecb: ECB_DAILY }) as unknown as typeof fetch,
    );

    expect(quotesFrom(upserts).USD).toBeDefined();
    expect(result.failed).toEqual(['nbu']);
  });

  it('files what it got when the ECB is down', async () => {
    const { db, upserts } = fakeDb();

    const result = await syncFxRates(
      db,
      respondPerUrl({ nbu: NBU_DAILY }) as unknown as typeof fetch,
    );

    expect(quotesFrom(upserts).UAH).toBeDefined();
    expect(result.failed).toEqual(['ecb']);
  });

  // Nothing to file and nothing to fall back on but yesterday's table, which
  // is exactly when somebody needs to be told.
  it('throws when neither source answers', async () => {
    const { db } = fakeDb();

    await expect(syncFxRates(db, respondPerUrl({}) as unknown as typeof fetch)).rejects.toThrow(
      /both/i,
    );
  });
});

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
      syncFxRates(db, respondPerUrl({ ecb: ECB_DAILY, nbu: NBU_DAILY }) as unknown as typeof fetch),
    ).resolves.toMatchObject({ asOf: '2026-08-25', quoted: 3, failed: [] });
  });

  /**
   * A 503 must not reach the parser. Parsing an error page produces "no
   * publication date", which sends whoever reads the log looking at the parser
   * rather than at the status code.
   *
   * With two sources this is no longer a thrown error but a named failure: the
   * feed that did answer is still filed, and the one that did not is reported.
   */
  it('reports a source that answered with an error rather than parsing it', async () => {
    const { db, upserts } = fakeDb();

    const result = await syncFxRates(
      db,
      respondPerUrl({ nbu: NBU_DAILY }) as unknown as typeof fetch,
    );

    expect(result.failed).toEqual(['ecb']);
    expect(quotesFrom(upserts).UAH).toBeDefined();
  });

  it('reports a source whose body is not the feed at all', async () => {
    const { db, upserts } = fakeDb();

    const result = await syncFxRates(
      db,
      respondPerUrl({ ecb: ECB_DAILY, nbu: '<html>hello</html>' }) as unknown as typeof fetch,
    );

    expect(result.failed).toEqual(['nbu']);
    expect(quotesFrom(upserts).USD).toBeDefined();
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
