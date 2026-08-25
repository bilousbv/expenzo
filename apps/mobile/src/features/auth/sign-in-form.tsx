import { Button } from '@expenzo/ui';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SignInFormProps {
  onSubmit: (email: string) => Promise<void>;
}

export function SignInForm({ onSubmit }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit() {
    // Guarding here as well as with `disabled`: a fast double tap can land two
    // presses before the re-render, and sending twice invalidates the first
    // link — which reads as "the link is broken" to whoever taps the older mail.
    if (pending) return;

    const trimmed = email.trim();
    setError(null);

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    setPending(true);
    try {
      await onSubmit(trimmed);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the link. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">Email</Text>

      <TextInput
        testID="sign-in-email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        className="rounded-card border border-brand-100 bg-white px-4 py-3 text-content"
      />

      <Button testID="sign-in-submit" disabled={pending} onPress={handleSubmit}>
        {pending ? 'Sending…' : 'Send magic link'}
      </Button>

      {error ? (
        <Text testID="sign-in-error" className="text-sm text-red-600">
          {error}
        </Text>
      ) : null}

      {sent && !error ? (
        <Text testID="sign-in-sent" className="text-sm text-content-muted">
          Check your email for a sign-in link.
        </Text>
      ) : null}
    </View>
  );
}
