import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SupabaseProvider } from '../provider';
import type { Db } from '../types';
import { useBudgetSummary } from './use-summary';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const ANA = '22222222-2222-4222-8222-222222222222';

/**
 * A household that earned 5,000 and spent 1,200, of which Ana spent 300 and
 * earned nothing — the salary was recorded by somebody else.
 */
function fakeDb() {
  const rpc = vi.fn((_name: string, args: { member?: string }) =>
    Promise.resolve({
      data:
        args.member === undefined
          ? [
              { direction: 'income', total_minor: 500_000 },
              { direction: 'spend', total_minor: 120_000 },
            ]
          : [{ direction: 'spend', total_minor: 30_000 }],
      error: null,
    }),
  );

  return { db: { rpc } as unknown as Db, rpc };
}

function wrapper(db: Db, client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SupabaseProvider client={db}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </SupabaseProvider>
    );
  };
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

const window = { from: '2026-08-01', to: '2026-08-31' };

describe('useBudgetSummary', () => {
  it('reports the household figures when nobody is selected', async () => {
    const { db } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, window), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toEqual({
      incomeMinor: 500_000,
      spentMinor: 120_000,
      balanceMinor: 380_000,
    });
  });

  /*
   * The author filter is a filter on spending. Money arriving belongs to the
   * household rather than to whoever happened to record it, so switching
   * between members must not move the income figure — otherwise picking a
   * member who has never entered a salary reads as a household with no income
   * at all.
   */
  it('keeps income household-wide when a member is selected', async () => {
    const { db } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, { ...window, memberId: ANA }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.incomeMinor).toBe(500_000);
  });

  it('narrows spending to the member who recorded it', async () => {
    const { db } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, { ...window, memberId: ANA }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.spentMinor).toBe(30_000);
  });

  // The three figures on the balance panel have to agree with each other: the
  // big number is the difference of the two beneath it, whatever is selected.
  it('leaves the balance as the difference of the two figures shown', async () => {
    const { db } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, { ...window, memberId: ANA }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data?.balanceMinor).toBe(470_000);
  });

  it('asks for both the household and the member', async () => {
    const { db, rpc } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, { ...window, memberId: ANA }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(rpc).toHaveBeenCalledWith('expense_summary', {
      from_on: window.from,
      to_on: window.to,
      member: ANA,
    });
    expect(rpc).toHaveBeenCalledWith('expense_summary', {
      from_on: window.from,
      to_on: window.to,
      member: undefined,
    });
  });

  /*
   * With nobody selected the two queries are the same question, and their keys
   * hash identically — so the default view costs one request, not two. A second
   * round trip on the most-visited screen in the app to fetch a figure it
   * already has would be a poor trade for one conditional.
   */
  it('makes one request when nobody is selected', async () => {
    const { db, rpc } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, window), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('has no figures until both answers are in', async () => {
    const { db } = fakeDb();
    const { result } = renderHook(() => useBudgetSummary(HOUSEHOLD, { ...window, memberId: ANA }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    expect(result.current.data).toBeUndefined();
    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
