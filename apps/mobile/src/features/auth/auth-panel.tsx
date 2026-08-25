import type { OAuthProvider } from '@expenzo/domain';
import { Button } from '@expenzo/ui';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { env } from '../../env';
import { supabase } from '../../lib/supabase';

import { CredentialsForm, type CredentialsMode } from './credentials-form';
import { SignInForm } from './sign-in-form';

/**
 * Wires the sign-in and register screens to Supabase, so the forms stay
 * presentational and testable without a client.
 */
export function AuthPanel({ mode }: { mode: CredentialsMode }) {
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);

  const registering = mode === 'signUp';

  // Resolves to expenzo://auth/callback, which app.json's scheme registers and
  // supabase/config.toml allows as a redirect target.
  const redirectTo = Linking.createURL('/auth/callback');

  async function submitCredentials({ email, password }: { email: string; password: string }) {
    const { error } = registering
      ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: redirectTo } })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error(error.message);

    // No navigation here: the listener in SessionProvider sees the new session
    // and the Stack.Protected guards swap the tree over on their own.
  }

  async function sendMagicLink(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    if (error) throw new Error(error.message);
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
      if (!data.url) throw new Error('That provider did not return a sign-in URL.');

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      // A cancelled or dismissed session is not a failure worth shouting about;
      // the user simply backed out.
      if (result.type !== 'success') return;

      // openAuthSessionAsync hands the deep link back rather than routing it, so
      // the code is exchanged here rather than on the callback screen.
      const code = new URL(result.url).searchParams.get('code');
      if (!code) throw new Error('That sign-in link is missing its code.');

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) throw new Error(exchangeError.message);
    } catch (cause) {
      setProviderError(cause instanceof Error ? cause.message : 'Could not reach that provider.');
    }
  }

  return (
    <View className="gap-gutter">
      <CredentialsForm mode={mode} onSubmit={submitCredentials} />

      {env().oauthProviders.map((provider) => (
        <Button
          key={provider}
          testID={`oauth-${provider}`}
          variant="secondary"
          onPress={() => void signInWithProvider(provider)}
        >
          {provider === 'google' ? 'Continue with Google' : 'Continue with Apple'}
        </Button>
      ))}

      {providerError ? (
        <Text testID="oauth-error" className="text-sm text-red-600">
          {providerError}
        </Text>
      ) : null}

      {showMagicLink ? (
        <View className="gap-2 border-t border-brand-100 pt-gutter">
          <Text className="text-sm text-content-muted">
            We will email you a link. No password needed.
          </Text>
          <SignInForm onSubmit={sendMagicLink} />
        </View>
      ) : (
        <Button testID="show-magic-link" variant="ghost" onPress={() => setShowMagicLink(true)}>
          Email me a sign-in link instead
        </Button>
      )}
    </View>
  );
}
