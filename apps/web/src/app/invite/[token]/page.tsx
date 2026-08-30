import { previewInvitation } from '@expenzo/data';
import { inviteMode } from '@expenzo/domain';

import { InviteLanding } from '@/features/household/invite-landing';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.invite') };
}

/**
 * Redeeming an invitation.
 *
 * Outside the (app) group on purpose. Inside it, the layout's guard bounced an
 * unauthenticated visitor to /login and the token went with the URL they never
 * came back to — which is the one visitor this page exists for. What happens
 * instead is decided here and carried out by the client component: redeem it,
 * send them to sign in with the address already filled, send them to register
 * with it, or say the link is spent.
 */
export default async function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  // The preview is callable by `anon`, which is what makes the logged-out
  // branches possible at all. An unknown, spent or expired token previews
  // nothing — one answer for the three, giving away no hint about which.
  const [preview, { data: auth }] = await Promise.all([
    previewInvitation(supabase, token),
    supabase.auth.getUser(),
  ]);

  const mode = inviteMode({
    known: Boolean(preview),
    signedIn: Boolean(auth.user),
    accountExists: preview?.accountExists ?? false,
  });

  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <InviteLanding
        token={token}
        mode={mode}
        householdName={preview?.householdName ?? null}
        email={preview?.email ?? null}
        role={preview?.role ?? null}
      />
    </main>
  );
}
