'use client';

import type { OAuthProvider } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonLabelClass } from '@expenzo/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { env } from '@/env';
import { createClient } from '@/lib/supabase/browser';

import {
  CredentialsForm,
  type CredentialsMode,
  type CredentialsSubmission,
} from './credentials-form';
import { LoginForm } from './login-form';
import { OAuthButtons } from './oauth-buttons';

/**
 * Wires every sign-in route to Supabase, so the forms below stay presentational
 * and testable without a client.
 */
export function AuthPanel({ mode }: { mode: CredentialsMode }) {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/';
  const [showMagicLink, setShowMagicLink] = useState(false);

  const registering = mode === 'signUp';

  function callbackUrl() {
    // Built from the origin the browser actually used. Both localhost and
    // 127.0.0.1 are on the redirect allow-list in supabase/config.toml, because
    // GoTrue treats them as different origins and silently falls back to
    // site_url for anything not listed.
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`;
  }

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
            emailRedirectTo: callbackUrl(),
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

  async function sendMagicLink(email: string) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl() },
    });

    if (error) throw new Error(error.message);
  }

  async function signInWithProvider(provider: OAuthProvider) {
    const supabase = createClient();

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl(),
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
      <CredentialsForm mode={mode} onSubmit={submitCredentials} />

      <OAuthButtons providers={[...env().oauthProviders]} onSignIn={signInWithProvider} />

      {showMagicLink ? (
        /* Wrapped and labelled because once this section is open there are two
           email fields on the page, and an unscoped lookup matches both. */
        <div
          data-testid="magic-link"
          className="flex flex-col gap-2 border-t border-brand-100 pt-gutter"
        >
          <p className="text-sm text-content-muted">{t('auth.magicLinkExplainer')}</p>
          <LoginForm onSubmit={sendMagicLink} />
        </div>
      ) : (
        <button
          type="button"
          data-testid="show-magic-link"
          onClick={() => setShowMagicLink(true)}
          className={buttonLabelClass('ghost', 'sm')}
        >
          {t('auth.showMagicLink')}
        </button>
      )}

      <p className="text-center text-sm text-content-muted">
        {registering ? t('auth.alreadyHaveAccount') : t('auth.noAccountYet')}
        <Link
          href={registering ? '/login' : '/register'}
          className="text-brand-600 underline"
          data-testid={registering ? 'go-to-login' : 'go-to-register'}
        >
          {registering ? t('auth.signIn') : t('auth.createOne')}
        </Link>
      </p>
    </div>
  );
}
