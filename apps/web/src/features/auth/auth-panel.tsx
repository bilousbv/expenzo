'use client';

import type { OAuthProvider } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonLabelClass } from '@expenzo/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { env } from '@/env';
import { createClient } from '@/lib/supabase/browser';

import {
  CredentialsForm,
  type CredentialsMode,
  type CredentialsSubmission,
} from './credentials-form';
import { OAuthButtons } from './oauth-buttons';
import { callbackUrl, magicLinkHref } from './urls';

/**
 * Wires every sign-in route to Supabase, so the forms below stay presentational
 * and testable without a client.
 */
export function AuthPanel({ mode }: { mode: CredentialsMode }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/';
  // Carried by an invitation link, which knows which address it was sent to.
  const invitedEmail = searchParams.get('email') ?? '';

  const registering = mode === 'signUp';

  async function submitCredentials({
    email,
    password,
    firstName,
    lastName,
    baseCurrency,
  }: CredentialsSubmission) {
    const supabase = createClient();

    const { error } = registering
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: callbackUrl(window.location.origin, redirectTo),
            /*
             * Read by the signup trigger, which writes the profile, the
             * household and the membership in one transaction. Sending these
             * as a second write once the session exists would leave a
             * half-filled account every time that write failed.
             */
            data: { first_name: firstName, last_name: lastName, base_currency: baseCurrency },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    // A full navigation rather than router.push: the session lives in cookies
    // the server components need, and only a real request re-runs them with the
    // new ones attached.
    window.location.assign(redirectTo);
  }

  async function signInWithProvider(provider: OAuthProvider) {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(window.location.origin, redirectTo),
        // The redirect is issued here rather than by the client, so the failure
        // is visible if the provider is misconfigured instead of the browser
        // simply leaving.
        skipBrowserRedirect: true,
      },
    });

    if (error) throw new Error(error.message);
    if (!data.url) throw new Error(t('auth.errors.providerNoUrl'));

    window.location.assign(data.url);
  }

  return (
    <div className="flex flex-col gap-gutter">
      <CredentialsForm mode={mode} onSubmit={submitCredentials} initialEmail={invitedEmail} />

      <OAuthButtons providers={[...env().oauthProviders]} onSignIn={signInWithProvider} />

      {/* Signing in only. A link signs an existing account in and no longer
          opens one, so offering it here would be offering a way to register
          that does not register. It points at a page of its own rather than
          unfolding a section: two email fields on one screen were ambiguous to
          fill, and asking for a link is a different way in rather than a
          variation on this form. */}
      {registering ? null : (
        <Link
          href={magicLinkHref(redirectTo)}
          data-testid="show-magic-link"
          className={`text-center ${buttonLabelClass('ghost', 'sm')}`}
        >
          {t('auth.showMagicLink')}
        </Link>
      )}

      <p className="text-center text-sm text-content-muted">
        {registering ? t('auth.alreadyHaveAccount') : t('auth.noAccountYet')}
        <Link
          href={registering ? '/login' : '/register'}
          className="text-link underline"
          data-testid={registering ? 'go-to-login' : 'go-to-register'}
        >
          {registering ? t('auth.signIn') : t('auth.createOne')}
        </Link>
      </p>
    </div>
  );
}
