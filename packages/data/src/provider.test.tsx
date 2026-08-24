import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupabaseProvider, useSupabase } from './provider';
import type { Db } from './types';

// The client is injected rather than constructed here, because web needs
// cookie-backed storage and native needs AsyncStorage. A stand-in is all this
// test needs.
const fakeClient = { from: () => ({}) } as unknown as Db;

describe('useSupabase', () => {
  it('returns the injected client', () => {
    const { result } = renderHook(() => useSupabase(), {
      wrapper: ({ children }) => (
        <SupabaseProvider client={fakeClient}>{children}</SupabaseProvider>
      ),
    });

    expect(result.current).toBe(fakeClient);
  });

  // Failing loudly beats returning undefined and surfacing as
  // "cannot read properties of undefined" somewhere in a query.
  it('throws a useful message when used outside a provider', () => {
    expect(() => renderHook(() => useSupabase())).toThrow(/SupabaseProvider/);
  });
});
