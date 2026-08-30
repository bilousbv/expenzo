'use client';

import { acceptInvitation } from '@expenzo/data';
import type { InviteMode } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, Card } from '@expenzo/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/browser';

export interface InviteLandingProps {
  token: string;
  mode: InviteMode;
  householdName: string | null;
  /** The address the invitation was sent to, prefilled into whichever form. */
  email: string | null;
  role: string | null;
  /** Overridable so a test can drive both halves of the handoff. */
  isMobile?: boolean;
}

function mobileAgent(): boolean {
  if (typeof navigator === 'undefined') return false;

  return /android|iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * What happens when somebody opens an invitation link.
 *
 * Four outcomes, decided on the server and carried out here: redeem it, send
 * them to sign in, send them to register, or say the link is spent. Doing the
 * work in the client is what lets the phone get first refusal — a scheme link
 * has to be attempted from a page that is still on screen.
 */
export function InviteLanding({
  token,
  mode,
  householdName,
  email,
  role,
  isMobile,
}: InviteLandingProps) {
  const { t } = useTranslation();
  const router = useRouter();

  const [phone] = useState(() => isMobile ?? mobileAgent());
  // Set once the visitor has said to stay in the browser, or once there was
  // never a phone to hand off to.
  const [handedOff, setHandedOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  const appLink = `expenzo://invite/${token}`;

  // The app gets first refusal, once. Nothing else runs until the visitor
  // either comes back or says to carry on here: redeeming the token in the
  // browser while the app is opening would spend it before the app arrived.
  useEffect(() => {
    if (phone && mode !== 'invalid') window.location.href = appLink;
  }, [appLink, mode, phone]);

  const waiting = phone && !handedOff && mode !== 'invalid';

  useEffect(() => {
    if (waiting || mode === 'invalid') return;

    if (mode === 'signIn' || mode === 'register') {
      const next = encodeURIComponent(`/invite/${token}`);
      const address = encodeURIComponent(email ?? '');
      router.replace(`/${mode === 'signIn' ? 'login' : 'register'}?next=${next}&email=${address}`);
      return;
    }

    let cancelled = false;

    void acceptInvitation(createClient(), token)
      .then(() => {
        if (!cancelled) setJoined(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : t('invite.failed'));
      });

    return () => {
      cancelled = true;
    };
  }, [email, mode, router, t, token, waiting]);

  if (waiting) {
    return (
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">
          {t('invite.title', { household: householdName ?? '' })}
        </h1>

        <a
          href={appLink}
          data-testid="open-in-app"
          className={buttonContainerClass('primary', 'md')}
        >
          <span className={buttonLabelClass('primary', 'md')}>{t('invite.openInApp')}</span>
        </a>
        <p className="text-sm text-content-muted">{t('invite.openInAppExplainer')}</p>

        <button
          type="button"
          data-testid="continue-in-browser"
          onClick={() => setHandedOff(true)}
          className={buttonContainerClass('secondary', 'md')}
        >
          <span className={buttonLabelClass('secondary', 'md')}>{t('common.continueHere')}</span>
        </button>
      </Card>
    );
  }

  if (mode === 'invalid' || error) {
    return (
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">{t('invite.failed')}</h1>
        {error ? (
          <p role="alert" data-testid="invite-error" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        <p className="text-sm text-content-muted">{t('invite.explainer')}</p>
        <Link href="/" className="text-sm text-link">
          {t('nav.backToExpenses')}
        </Link>
      </Card>
    );
  }

  if (joined) {
    return (
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content" data-testid="invite-accepted">
          {t('household.joined')}
        </h1>
        <p className="text-sm text-content-muted">{t('household.joinedExplainer')}</p>
        <Link href="/" className="text-sm text-link">
          {t('nav.goToExpenses')}
        </Link>
      </Card>
    );
  }

  // Signing in, registering, or redeeming — all of them land somewhere else in
  // a moment, and none of them is worth a spinner of its own.
  return (
    <Card className="w-full max-w-sm gap-gutter">
      <h1 className="text-2xl font-bold text-content">
        {t('invite.title', { household: householdName ?? '' })}
      </h1>
      {role ? (
        <p className="text-sm text-content-muted" data-testid="invite-role">
          {t('invite.joinAs', { role: t(`household.roles.${role}`) })}
        </p>
      ) : null}
      <p className="text-sm text-content-muted">
        {email
          ? t(mode === 'register' ? 'invite.registerToJoin' : 'invite.signInToJoin', { email })
          : null}
      </p>
    </Card>
  );
}
