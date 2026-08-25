import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import { listSupportedCurrencies } from '../repositories/fx';

/**
 * The currencies an expense may be entered in.
 *
 * Rates change daily but the set of quoted currencies does not, so this is held
 * for a day rather than refetched with every entry form.
 */
export function useSupportedCurrencies(baseCurrency: string | undefined) {
  const db = useSupabase();

  return useQuery<string[]>({
    queryKey: queryKeys.currencies.supported(baseCurrency ?? ''),
    queryFn: () => listSupportedCurrencies(db, baseCurrency as string),
    enabled: Boolean(baseCurrency),
    staleTime: 24 * 60 * 60 * 1000,
  });
}
