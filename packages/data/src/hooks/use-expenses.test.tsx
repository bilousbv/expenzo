import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../keys';
import { SupabaseProvider } from '../provider';
import type { Db } from '../types';
import { useCreateExpense, useExpenses } from './use-expenses';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';
const USER = '22222222-2222-4222-8222-222222222222';

function expenseRow(id: string, occurredOn = '2026-08-25') {
  return {
    id,
    household_id: HOUSEHOLD,
    created_by: USER,
    amount_minor: 1250,
    currency: 'USD',
    base_amount_minor: 1250,
    category_id: null,
    merchant: 'Blue Bottle',
    note: null,
    occurred_on: occurredOn,
  };
}

/** Serves a different set of rows per call, so paging can be exercised. */
function fakeDb(pages: unknown[][]) {
  let call = 0;

  const builder = {
    select: () => builder,
    insert: () => builder,
    is: () => builder,
    eq: () => builder,
    gte: () => builder,
    lte: () => builder,
    or: () => builder,
    order: () => builder,
    single: () => Promise.resolve({ data: expenseRow('new'), error: null }),
    limit: () => {
      const data = pages[Math.min(call, pages.length - 1)];
      call += 1;
      return Promise.resolve({ data, error: null });
    },
  };

  return { db: { from: vi.fn(() => builder) } as unknown as Db, calls: () => call };
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

describe('useExpenses', () => {
  it('returns the first page', async () => {
    const { db } = fakeDb([[expenseRow('a'), expenseRow('b')]]);
    const { result } = renderHook(() => useExpenses({ householdId: HOUSEHOLD, pageSize: 2 }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0]?.rows.map((row) => row.id)).toEqual(['a', 'b']);
  });

  // A page that came back full means there may be more; one that did not, means
  // there is not. Getting this wrong shows an infinite spinner at the bottom.
  it('offers a next page only when one came back full', async () => {
    const { db } = fakeDb([[expenseRow('a'), expenseRow('b'), expenseRow('c')]]);
    const { result } = renderHook(() => useExpenses({ householdId: HOUSEHOLD, pageSize: 2 }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);
  });

  it('stops when the last page is short', async () => {
    const { db } = fakeDb([[expenseRow('a')]]);
    const { result } = renderHook(() => useExpenses({ householdId: HOUSEHOLD, pageSize: 2 }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(false);
  });

  it('fetches the following page on request', async () => {
    const { db } = fakeDb([
      [expenseRow('a'), expenseRow('b'), expenseRow('c')],
      [expenseRow('c', '2026-08-01')],
    ]);
    const { result } = renderHook(() => useExpenses({ householdId: HOUSEHOLD, pageSize: 2 }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    // Wrapped in act and re-read afterwards: `result.current` is a snapshot, so
    // calling fetchNextPage on it and then asserting against the same snapshot
    // tests nothing.
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.data?.[1]?.rows.map((row) => row.id)).toEqual(['c']);
  });

  // Different filters are different lists. Sharing a key would show last
  // month's rows under this month's filter until something refetched.
  it('caches each filter separately', async () => {
    const client = newQueryClient();
    const { db } = fakeDb([[expenseRow('a')]]);

    renderHook(() => useExpenses({ householdId: HOUSEHOLD, filter: { memberId: USER } }), {
      wrapper: wrapper(db, client),
    });

    await waitFor(() =>
      expect(
        client.getQueryData(queryKeys.expenses.list(HOUSEHOLD, { memberId: USER })),
      ).toBeDefined(),
    );

    expect(client.getQueryData(queryKeys.expenses.list(HOUSEHOLD, {}))).toBeUndefined();
  });

  it('does not run until the household id is known', () => {
    const { db } = fakeDb([[]]);
    const { result } = renderHook(() => useExpenses({ householdId: undefined }), {
      wrapper: wrapper(db, newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('useCreateExpense', () => {
  // Invalidating the whole collection rather than one filtered list: a new
  // expense can belong to any filter currently on screen.
  it('invalidates every expense list for the household', async () => {
    const client = newQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { db } = fakeDb([[]]);

    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD, USER), {
      wrapper: wrapper(db, client),
    });

    await result.current.mutateAsync({
      amountMinor: 1250,
      currency: 'USD',
      occurredOn: '2026-08-25',
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.expenses.all(HOUSEHOLD) });
  });

  it('refuses to write without a signed-in user', async () => {
    const { db } = fakeDb([[]]);
    const { result } = renderHook(() => useCreateExpense(HOUSEHOLD, undefined), {
      wrapper: wrapper(db, newQueryClient()),
    });

    await expect(
      result.current.mutateAsync({ amountMinor: 1250, currency: 'USD', occurredOn: '2026-08-25' }),
    ).rejects.toThrow(/signed-in user/i);
  });
});
