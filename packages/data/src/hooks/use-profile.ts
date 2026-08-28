import type { UpdateProfileInput } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { displayCurrencyFrom, type DisplayCurrency } from '../display-currency';
import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import { getDisplayRate } from '../repositories/fx';
import { getMyProfile, updateMyProfile, type ProfileRow } from '../repositories/profiles';
import { useCurrentHousehold } from './use-household';

/**
 * The caller's own profile.
 *
 * The user id is resolved here rather than passed in, so both platforms call
 * this the same way — web has it on the server and native has it in a session
 * context, and threading it through every screen would be two different shapes
 * of the same wiring.
 */
export function useMyProfile() {
  const db = useSupabase();

  return useQuery<ProfileRow | null>({
    queryKey: queryKeys.profile.me(),
    queryFn: async () => {
      const {
        data: { user },
      } = await db.auth.getUser();

      return user ? getMyProfile(db, user.id) : null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateMyProfile() {
  const db = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const {
        data: { user },
      } = await db.auth.getUser();

      if (!user) throw new Error('Not signed in');

      return updateMyProfile(db, user.id, input);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.me(), profile);
      // The roster shows names, so renaming yourself changes what every expense
      // row is labelled with.
      void queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

/**
 * The currency this member reads household figures in, and how to get there.
 *
 * Held for a day: the rate moves once a day at most, and refetching it per
 * screen would put a round trip in front of every total for a number that has
 * not changed.
 */
export function useDisplayCurrency(): DisplayCurrency {
  const db = useSupabase();
  const household = useCurrentHousehold();
  const profile = useMyProfile();

  const baseCurrency = household.data?.base_currency ?? 'USD';
  const preferred = profile.data?.displayCurrency ?? null;

  const rate = useQuery<number | null>({
    queryKey: queryKeys.currencies.rate(baseCurrency, preferred ?? baseCurrency),
    queryFn: () => getDisplayRate(db, baseCurrency, preferred as string),
    enabled: Boolean(preferred) && preferred !== baseCurrency,
    staleTime: 24 * 60 * 60 * 1000,
  });

  return displayCurrencyFrom(baseCurrency, preferred, rate.data);
}
