'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { Db } from './types';

/**
 * Plain React context, so it behaves identically under React DOM and React
 * Native. This is one of the rare .tsx files in the repo with no .native.tsx
 * twin — the convention would otherwise imply one is missing.
 */
const SupabaseContext = createContext<Db | null>(null);

export interface SupabaseProviderProps {
  client: Db;
  children: ReactNode;
}

export function SupabaseProvider({ client, children }: SupabaseProviderProps) {
  return <SupabaseContext.Provider value={client}>{children}</SupabaseContext.Provider>;
}

export function useSupabase(): Db {
  const client = useContext(SupabaseContext);

  if (!client) {
    throw new Error('useSupabase must be used inside a SupabaseProvider');
  }

  return client;
}
