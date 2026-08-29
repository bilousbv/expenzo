import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../types';
import { getCategorySpend, getDailyNet, getPeriodSummary } from './summary';

const MEMBER = '11111111-1111-4111-8111-111111111111';
const ANA = MEMBER;
const CATEGORY = '22222222-2222-4222-8222-222222222222';

function fakeDb(data: unknown, error: { message: string } | null = null) {
  const calls: Array<[string, Record<string, unknown>]> = [];
  const db = {
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      calls.push([name, args]);
      return Promise.resolve({ data, error });
    }),
  };

  return { db: db as unknown as Db, calls };
}

const window = { from: '2026-08-01', to: '2026-08-31' };

describe('getPeriodSummary', () => {
  it('calls the summary function with the period', async () => {
    const { db, calls } = fakeDb([]);

    await getPeriodSummary(db, window);

    expect(calls[0]?.[0]).toBe('expense_summary');
    expect(calls[0]?.[1]).toMatchObject({ from_on: '2026-08-01', to_on: '2026-08-31' });
  });

  it('passes the author through when one is chosen', async () => {
    const { db, calls } = fakeDb([]);

    await getPeriodSummary(db, { ...window, memberId: MEMBER });

    expect(calls[0]?.[1].member).toBe(MEMBER);
  });

  it('splits the two directions', async () => {
    const { db } = fakeDb([
      { direction: 'spend', total_minor: 3500 },
      { direction: 'income', total_minor: 500000 },
    ]);

    await expect(getPeriodSummary(db, window)).resolves.toEqual({
      spentMinor: 3500,
      incomeMinor: 500000,
      balanceMinor: 496500,
    });
  });

  // A month with outgoings and no income is the common case, and it must not
  // produce NaN in the balance.
  it('treats a missing direction as zero', async () => {
    const { db } = fakeDb([{ direction: 'spend', total_minor: 3500 }]);

    await expect(getPeriodSummary(db, window)).resolves.toEqual({
      spentMinor: 3500,
      incomeMinor: 0,
      balanceMinor: -3500,
    });
  });

  it('reports zeros for a period with nothing in it', async () => {
    const { db } = fakeDb([]);

    await expect(getPeriodSummary(db, window)).resolves.toEqual({
      spentMinor: 0,
      incomeMinor: 0,
      balanceMinor: 0,
    });
  });

  // Postgres sums bigint, and PostgREST can hand a bigint back as a string
  // rather than a number. Concatenating those instead of adding them would be
  // silent and spectacular.
  it('coerces a bigint returned as a string', async () => {
    const { db } = fakeDb([
      { direction: 'spend', total_minor: '3500' },
      { direction: 'income', total_minor: '500000' },
    ]);

    const summary = await getPeriodSummary(db, window);

    expect(summary.spentMinor).toBe(3500);
    expect(summary.balanceMinor).toBe(496500);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb(null, { message: 'permission denied' });

    await expect(getPeriodSummary(db, window)).rejects.toThrow('permission denied');
  });
});

describe('getCategorySpend', () => {
  it('calls the category function', async () => {
    const { db, calls } = fakeDb([]);

    await getCategorySpend(db, window);

    expect(calls[0]?.[0]).toBe('category_summary');
  });

  it('maps the rows', async () => {
    const { db } = fakeDb([{ category_id: CATEGORY, total_minor: 2500 }]);

    await expect(getCategorySpend(db, window)).resolves.toEqual([
      { categoryId: CATEGORY, totalMinor: 2500 },
    ]);
  });

  // Expenses with no category still sum to something, and dropping them would
  // make the rollup disagree with the period total.
  it('keeps the uncategorised bucket rather than discarding it', async () => {
    const { db } = fakeDb([{ category_id: null, total_minor: 900 }]);

    await expect(getCategorySpend(db, window)).resolves.toEqual([
      { categoryId: null, totalMinor: 900 },
    ]);
  });

  it('returns an empty list rather than null', async () => {
    const { db } = fakeDb(null);

    await expect(getCategorySpend(db, window)).resolves.toEqual([]);
  });
});

describe('getDailyNet', () => {
  it('asks for the period and the author', async () => {
    const { db, calls } = fakeDb([]);

    await getDailyNet(db, { from: '2026-03-01', to: '2026-03-31', memberId: ANA });

    expect(calls[0]).toEqual([
      'daily_net',
      { from_on: '2026-03-01', to_on: '2026-03-31', member: ANA },
    ]);
  });

  // The column names cross the wire in snake case; every consumer in the app
  // reads camel.
  it('names the columns the way the app does', async () => {
    const { db } = fakeDb([{ occurred_on: '2026-03-01', net_minor: 60_000 }]);

    await expect(getDailyNet(db, { from: '2026-03-01', to: '2026-03-31' })).resolves.toEqual([
      { occurredOn: '2026-03-01', netMinor: 60_000 },
    ]);
  });

  /*
   * Postgres returns bigint as a string, because it does not fit a JavaScript
   * number safely. Left as one it would concatenate rather than add the first
   * time a balance was accumulated.
   */
  it('turns the bigint string into a number', async () => {
    const { db } = fakeDb([{ occurred_on: '2026-03-01', net_minor: '60000' }]);

    const days = await getDailyNet(db, { from: '2026-03-01', to: '2026-03-31' });

    expect(days[0]?.netMinor).toBe(60_000);
    expect(typeof days[0]?.netMinor).toBe('number');
  });

  // A period with nothing in it is an empty list, not a failure.
  it('returns nothing for a quiet period', async () => {
    const { db } = fakeDb(null);

    await expect(getDailyNet(db, { from: '2026-03-01', to: '2026-03-31' })).resolves.toEqual([]);
  });

  it('throws the database message', async () => {
    const { db } = fakeDb(null, { message: 'JWT expired' });

    await expect(getDailyNet(db, { from: '2026-03-01', to: '2026-03-31' })).rejects.toThrow(
      'JWT expired',
    );
  });
});
