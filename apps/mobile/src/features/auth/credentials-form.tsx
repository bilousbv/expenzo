import { credentialsSchema, registrationSchema } from '@expenzo/domain';
import { Button } from '@expenzo/ui';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

export type CredentialsMode = 'signIn' | 'signUp';

export interface CredentialsFormProps {
  mode: CredentialsMode;
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
}

const LABEL: Record<CredentialsMode, { idle: string; busy: string }> = {
  signIn: { idle: 'Sign in', busy: 'Signing in…' },
  signUp: { idle: 'Create account', busy: 'Creating account…' },
};

const inputClass = 'rounded-card border border-brand-100 bg-white px-4 py-3 text-content';

export function CredentialsForm({ mode, onSubmit }: CredentialsFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const registering = mode === 'signUp';

  async function handleSubmit() {
    // A fast double tap lands two presses before the re-render, and two sign-up
    // requests for one address race — the loser comes back "User already
    // registered" for an account the user just made themselves.
    if (pending) return;

    setError(null);

    // The same schemas the web app validates against, so the two clients cannot
    // disagree about what a password is.
    const parsed = registering
      ? registrationSchema.safeParse({ email, password, confirmPassword })
      : credentialsSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setPending(true);
    try {
      // Deliberately not spreading `parsed.data`: in signUp mode it carries
      // confirmPassword, which is only ever compared and must not be sent.
      await onSubmit({ email: parsed.data.email, password: parsed.data.password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign you in. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">Email</Text>
      <TextInput
        testID="credentials-email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        className={inputClass}
      />

      <Text className="text-sm font-medium text-content-muted">Password</Text>
      <TextInput
        testID="credentials-password"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        // Tells the OS password manager which kind of password this is, so it
        // offers to save a new one rather than filling the wrong existing one.
        autoComplete={registering ? 'new-password' : 'current-password'}
        secureTextEntry
        className={inputClass}
      />

      {registering ? (
        <>
          <Text className="text-sm font-medium text-content-muted">Confirm password</Text>
          <TextInput
            testID="credentials-confirm"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            secureTextEntry
            className={inputClass}
          />
        </>
      ) : null}

      <Button testID="credentials-submit" disabled={pending} onPress={handleSubmit}>
        {pending ? LABEL[mode].busy : LABEL[mode].idle}
      </Button>

      {error ? (
        <Text testID="credentials-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
