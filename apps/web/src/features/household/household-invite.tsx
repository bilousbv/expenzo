'use client';

import { createClient } from '@/lib/supabase/browser';

import { InviteForm } from './invite-form';

/**
 * Wires InviteForm to Supabase. Kept separate so the form itself stays a
 * plain presentational component that tests can drive without a client.
 */
export function HouseholdInvite({ origin }: { origin: string }) {
  async function invite(email: string): Promise<string> {
    const supabase = createClient();

    const { data, error } = await supabase.rpc('create_household_invitation', {
      invitee_email: email,
    });

    if (error) throw new Error(error.message);
    if (!data) throw new Error('The server did not return an invitation token.');

    return data;
  }

  return <InviteForm onInvite={invite} origin={origin} />;
}
