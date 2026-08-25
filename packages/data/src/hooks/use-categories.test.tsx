import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../keys';
import { SupabaseProvider } from '../provider';
import type { Db } from '../types';
import type { CategoryRow } from '../repositories/categories';
import { useCategories, useCreateCategory } from './use-categories';

const HOUSEHOLD = '11111111-1111-4111-8111-111111111111';

const system: CategoryRow = {
  id: '33333333-3333-4333-8333-333333333333',
  household_id: null,
  slug: 'groceries',
  name: 'Groceries',
  icon: 'shopping-cart',
  color: '#337dff',
  parent_id: null,
  is_system: true,
  sort_order: 10,
  archived_at: null,
};

const custom: CategoryRow = {
  ...system,
  id: '44444444-4444-4444-8444-444444444444',
  household_id: HOUSEHOLD,
  slug: 'coffee',
  name: 'Coffee',
  is_system: false,
  sort_order: 500,
};

function fakeDb(rows: CategoryRow[]) {
  const builder = {
    select: () => builder,
    insert: () => builder,
    is: () => builder,
    eq: () => builder,
    order: () => builder,
    single: () => Promise.resolve({ data: custom, error: null }),
    then: (resolve: (value: { data: CategoryRow[]; error: null }) => unknown) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
  };

  return { from: vi.fn(() => builder) } as unknown as Db;
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

describe('useCategories', () => {
  it('caches under the shared key, so an invalidation from anywhere reaches it', async () => {
    const client = newQueryClient();
    const { result } = renderHook(() => useCategories(HOUSEHOLD), {
      wrapper: wrapper(fakeDb([system, custom]), client),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(client.getQueryData(queryKeys.categories.all(HOUSEHOLD))).toHaveLength(2);
  });

  // System categories come back with a null household_id, so a naive consumer
  // filtering on the household would show an empty picker.
  it('returns system and household categories together', async () => {
    const { result } = renderHook(() => useCategories(HOUSEHOLD), {
      wrapper: wrapper(fakeDb([system, custom]), newQueryClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.map((category) => category.slug)).toEqual(['groceries', 'coffee']);
  });

  // Without a household id the query key would collide across households and
  // one household's list could be served to another after a switch.
  it('does not run until the household id is known', () => {
    const db = fakeDb([system]);
    const { result } = renderHook(() => useCategories(undefined), {
      wrapper: wrapper(db, newQueryClient()),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe('useCreateCategory', () => {
  it('invalidates the category list so every screen picks the new one up', async () => {
    const client = newQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useCreateCategory(HOUSEHOLD), {
      wrapper: wrapper(fakeDb([]), client),
    });

    await result.current.mutateAsync({ name: 'Coffee', sortOrder: 500 });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.categories.all(HOUSEHOLD) });
  });
});
