import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  clearMyAvatar,
  setMyAvatar,
  signedAvatarUrls,
  type AvatarUpload,
} from '../repositories/avatars';
import { useMyProfile } from './use-profile';

/**
 * Signed URLs for a set of stored paths.
 *
 * Cached under the sorted paths rather than per member, so the roster signs
 * once for everybody instead of once per face. Held for less than the URLs
 * live, so a refetch always replaces them before they expire.
 */
export function useAvatarUrls(paths: (string | null | undefined)[]) {
  const db = useSupabase();
  const wanted = [...new Set(paths.filter((path): path is string => Boolean(path)))].sort();

  return useQuery<Map<string, string>>({
    queryKey: queryKeys.avatars.signed(wanted),
    queryFn: () => signedAvatarUrls(db, wanted),
    enabled: wanted.length > 0,
    staleTime: 30 * 60 * 1000,
  });
}

/** The caller's own photo, for the profile screen. */
export function useMyAvatarUrl() {
  const profile = useMyProfile();
  const urls = useAvatarUrls([profile.data?.avatarPath]);

  return profile.data?.avatarPath ? (urls.data?.get(profile.data.avatarPath) ?? null) : null;
}

export function useSetMyAvatar() {
  const db = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: AvatarUpload) => {
      const {
        data: { user },
      } = await db.auth.getUser();

      if (!user) throw new Error('Not signed in');

      return setMyAvatar(db, user.id, file);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.me(), profile);
      // The path is unchanged when a photo is replaced, so the cached signed
      // URL still points at the old image until these are dropped.
      void queryClient.invalidateQueries({ queryKey: ['avatars'] });
      void queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}

export function useClearMyAvatar() {
  const db = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { user },
      } = await db.auth.getUser();

      if (!user) throw new Error('Not signed in');

      return clearMyAvatar(db, user.id);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(queryKeys.profile.me(), profile);
      void queryClient.invalidateQueries({ queryKey: ['avatars'] });
      void queryClient.invalidateQueries({ queryKey: ['households'] });
    },
  });
}
