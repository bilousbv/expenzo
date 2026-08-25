import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import { getCurrentHousehold, type HouseholdRow } from '../repositories/households';

/**
 * The caller's household, which every other key is scoped by.
 *
 * Cached under its own id once it is known. Before then the key is a constant,
 * because there is nothing yet to scope it by — and there is nothing cached
 * from another household to collide with either, since a session only ever sees
 * one.
 */
export function useCurrentHousehold() {
  const db = useSupabase();

  return useQuery<HouseholdRow | null>({
    queryKey: queryKeys.households.current('current'),
    queryFn: () => getCurrentHousehold(db),
  });
}
