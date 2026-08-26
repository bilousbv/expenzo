'use client';

import { createClient } from '@/lib/supabase/browser';

import { useTranslation } from '@expenzo/i18n';

import { InviteForm } from './invite-form';

/**
 * Wires InviteForm to Supabase. Kept separate so the form itself stays a
 * plain presentational component that tests can drive without a client.
 */
export function HouseholdInvite({ origin }: { origin: string }) {
  const { t } = useTranslation();
  async function invite(email: string): Promise<string> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('create_household_invitation', {
      invitee_email: email,
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error(t('household.errors.noToken'));

    return data;
  }

  return <InviteForm onInvite={invite} origin={origin} />;
}
