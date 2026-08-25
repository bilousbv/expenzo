'use client';

import { credentialsSchema, registrationSchema, type Credentials } from '@expenzo/domain';
import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export type CredentialsMode = 'signIn' | 'signUp';

export interface CredentialsFormProps {
  mode: CredentialsMode;
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
}

const LABEL: Record<CredentialsMode, { idle: string; busy: string }> = {
  signIn: { idle: 'Sign in', busy: 'Signing in…' },
  signUp: { idle: 'Create account', busy: 'Creating account…' },
};

const inputClass =
  'rounded-card border border-brand-100 bg-white px-4 py-3 text-content outline-none focus:border-brand-500';

export function CredentialsForm({ mode, onSubmit }: CredentialsFormProps) {
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const registering = mode === 'signUp';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Two sign-up requests for the same address race each other, and the loser
    // comes back "User already registered" for an account the user just made.
    if (pending) return;

    setError(null);

    // The same schemas the server's rules are mirrored from, so a password the
    // browser accepts is one GoTrue accepts.
    const parsed = registering
      ? registrationSchema.safeParse({ email, password, confirmPassword })
      : credentialsSchema.safeParse({ email, password });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setPending(true);
    try {
      // Deliberately not spreading `parsed.data`: in signUp mode that carries
      // confirmPassword, which is only ever compared and must not be sent.
      await onSubmit({ email: parsed.data.email, password: parsed.data.password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign you in. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={emailId} className="text-sm font-medium text-content-muted">
        Email
      </label>
      <input
        id={emailId}
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error ? true : undefined}
        placeholder="you@example.com"
        className={inputClass}
      />

      <label htmlFor={passwordId} className="text-sm font-medium text-content-muted">
        Password
      </label>
      <input
        id={passwordId}
        name="password"
        type="password"
        // Browsers only offer to save a password, and only fill the right one,
        // when the field says which kind it is.
        autoComplete={registering ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={inputClass}
      />

      {registering ? (
        <>
          <label htmlFor={confirmId} className="text-sm font-medium text-content-muted">
            Confirm password
          </label>
          <input
            id={confirmId}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            className={inputClass}
          />
        </>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {pending ? LABEL[mode].busy : LABEL[mode].idle}
        </span>
      </button>

      {/* Test ids as well as roles: Next's development overlay also renders an
          element with role="alert", so a bare role lookup is ambiguous. */}
      {error ? (
        <p role="alert" data-testid="credentials-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export type { Credentials };
