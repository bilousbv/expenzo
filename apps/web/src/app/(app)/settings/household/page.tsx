import { Card } from '@expenzo/ui';
import { headers } from 'next/headers';

import { HouseholdInvite } from '@/features/household/household-invite';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Household · Expenzo' };

export default async function HouseholdSettingsPage() {
  const supabase = await createClient();

  // Row-level security scopes both of these to the caller's household, so
  // neither query needs a household filter of its own.
  // Fetched separately rather than as a nested select: household_members and
  // profiles both reference auth.users but have no foreign key between them,
  // so PostgREST cannot infer the relationship. Adding one purely to satisfy a
  // join would be schema shaped around a query.
  const [{ data: household }, { data: members }, { data: profiles }] = await Promise.all([
    supabase.from('households').select('id, name, base_currency, timezone').maybeSingle(),
    supabase
      .from('household_members')
      .select('user_id, role, joined_at')
      .eq('status', 'active')
      .order('joined_at'),
    supabase.from('profiles').select('id, display_name'),
  ]);

  const nameFor = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));

  // Building the invite link needs the host the browser actually used, and a
  // server component has no window.
  const requestHeaders = await headers();
  const host = requestHeaders.get('x-forwarded-host') ?? requestHeaders.get('host') ?? '';
  const proto = requestHeaders.get('x-forwarded-proto') ?? 'http';
  const origin = `${proto}://${host}`;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-gutter p-gutter">
      <h1 className="text-3xl font-bold text-content">{household?.name ?? 'Household'}</h1>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">Members</h2>

        <ul className="flex flex-col gap-2">
          {(members ?? []).map((member) => (
            <li key={member.user_id} className="flex items-center justify-between">
              <span className="text-content" data-testid="member-name">
                {nameFor.get(member.user_id) ?? 'Member'}
              </span>
              <span className="text-sm text-content-muted">{member.role}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">Invite someone</h2>
        <HouseholdInvite origin={origin} />
      </Card>
    </main>
  );
}
