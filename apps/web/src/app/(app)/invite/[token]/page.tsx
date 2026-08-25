import { Card } from '@expenzo/ui';
import Link from 'next/link';

import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Join a household · Expenzo' };

/**
 * Redeeming an invitation.
 *
 * This route sits inside the (app) group, so an unauthenticated visitor is
 * sent to sign in first and arrives back here afterwards — which is what we
 * want, since accepting has to attribute the membership to someone.
 */
export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { error } = await supabase.rpc('accept_household_invitation', { token });

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-gutter">
        <Card className="w-full max-w-sm gap-gutter">
          <h1 className="text-2xl font-bold text-content">That invitation did not work</h1>
          <p role="alert" data-testid="invite-error" className="text-sm text-red-600">
            {error.message}
          </p>
          <p className="text-sm text-content-muted">
            Invitation links work once and expire after 14 days. Ask whoever invited you to send a
            new one.
          </p>
          <Link href="/" className="text-sm text-brand-600">
            Back to your expenses
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content" data-testid="invite-accepted">
          You have joined the household
        </h1>
        <p className="text-sm text-content-muted">
          Shared expenses and subscriptions are now visible to you.
        </p>
        <Link href="/" className="text-sm text-brand-600">
          Go to your expenses
        </Link>
      </Card>
    </main>
  );
}
