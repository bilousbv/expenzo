import type { OAuthProvider } from '@expenzo/domain';
import { Button } from '@expenzo/ui';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
import { Text, View } from 'react-native';

import { env } from '../../env';
import { supabase } from '../../lib/supabase';

import {
  CredentialsForm,
  type CredentialsMode,
  type CredentialsSubmission,
} from './credentials-form';

/**
 * Wires the sign-in and register screens to Supabase, so the forms stay
 * presentational and testable without a client.
 */
export function AuthPanel({ mode }: { mode: CredentialsMode }) {
  const { t } = useTranslation();
  /*
   * Carried by an invitation link, which knows the address it was sent to.
   * Signing in or registering as anybody else joins the wrong person to the
   * household, so it is filled in — prefilled rather than fixed, since
   * somebody who has to correct it should be able to.
   */
  const { email: invitedEmail } = useLocalSearchParams<{ email?: string }>();
  const [providerError, setProviderError] = useState<string | null>(null);

  const registering = mode === 'signUp';

  // Resolves to expenzo://auth/callback, which app.json's scheme registers and
  // supabase/config.toml allows as a redirect target.
  const redirectTo = Linking.createURL('/auth/callback');

  async function submitCredentials({
    email,
    password,
    firstName,
    lastName,
    baseCurrency,
  }: CredentialsSubmission) {
    const { error } = registering
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectTo,
            // Read by the signup trigger, which writes the profile, the
            // household and the membership in one transaction.
            data: { first_name: firstName, last_name: lastName, base_currency: baseCurrency },
          },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    // No navigation here: the listener in SessionProvider sees the new session
    // and the Stack.Protected guards swap the tree over on their own.
  }

  async function signInWithProvider(provider: OAuthProvider) {
    setProviderError(null);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          // There is no browser to redirect: the URL has to come back so it can
          // be opened in an auth session that returns control to the app.
          skipBrowserRedirect: true,
        },
      });

      if (error) throw new Error(error.message);
      if (!data.url) throw new Error(t('auth.errors.providerNoUrl'));

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      // A cancelled or dismissed session is not a failure worth shouting about;
      // the user simply backed out.
      if (result.type !== 'success') return;

      // openAuthSessionAsync hands the deep link back rather than routing it, so
      // the code is exchanged here rather than on the callback screen.
      const code = new URL(result.url).searchParams.get('code');
      if (!code) throw new Error(t('auth.errors.missingCode'));

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw new Error(exchangeError.message);
    } catch (cause) {
      setProviderError(
        cause instanceof Error ? cause.message : t('auth.errors.providerUnreachable'),
      );
    }
  }

  return (
    <View className="gap-gutter">
      <CredentialsForm mode={mode} onSubmit={submitCredentials} initialEmail={invitedEmail} />

      {env().oauthProviders.map((provider) => (
        <Button
          key={provider}
          testID={`oauth-${provider}`}
          variant="secondary"
          onPress={() => void signInWithProvider(provider)}
        >
          {t(provider === 'google' ? 'auth.continueWithGoogle' : 'auth.continueWithApple')}
        </Button>
      ))}

      {providerError ? (
        <Text testID="oauth-error" className="text-sm text-negative">
          {providerError}
        </Text>
      ) : null}

      {/* Signing in only. A link signs an existing account in and no longer
          opens one, so offering it here would be offering a way to register
          that does not register. It pushes a screen of its own rather than
          unfolding a section: two email fields in one form were ambiguous to
          fill, and asking for a link is a different way in rather than a
          variation on this form. */}
      {registering ? null : (
        <Button testID="show-magic-link" variant="ghost" onPress={() => router.push('/magic-link')}>
          {t('auth.showMagicLink')}
        </Button>
      )}
    </View>
  );
}
