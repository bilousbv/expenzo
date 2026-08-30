import type { InvitableRole } from '@expenzo/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '../keys';
import { useSupabase } from '../provider';
import {
  listPendingInvitations,
  revokeInvitation,
  sendInvitation,
  type InvitationRow,
} from '../repositories/invitations';

export function useInvitations(householdId: string | undefined) {
  const db = useSupabase();

  return useQuery<InvitationRow[]>({
    queryKey: queryKeys.households.invitations(householdId ?? ''),
    queryFn: () => listPendingInvitations(db),
    enabled: Boolean(householdId),
  });
}

export interface SendInvitationArgs {
  email: string;
  role?: InvitableRole;
}

/**
 * Inviting someone.
 *
 * The locale is the hook's rather than the caller's argument: what language the
 * email is written in is the language the person inviting is reading, and
 * making every call site remember that is how one of them ends up sending
 * English to a Ukrainian household.
 */
export function useSendInvitation(householdId: string | undefined, locale: string) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (args: SendInvitationArgs) => sendInvitation(db, args, locale),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.households.invitations(householdId ?? '') }),
  });
}

export function useRevokeInvitation(householdId: string | undefined) {
  const db = useSupabase();
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => revokeInvitation(db, id),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: queryKeys.households.invitations(householdId ?? '') }),
  });
}
