'use client';

import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginFormProps {
  onSubmit: (email: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = email.trim();
    setError(null);

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }

    // Sending twice invalidates the first link, which reads to the user as
    // "the link is broken".
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
        className="rounded-card border border-brand-100 bg-white px-4 py-3 text-content outline-none focus:border-brand-500"
        placeholder="you@example.com"
      />

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {pending ? 'Sending…' : 'Send magic link'}
        </span>
      </button>

      {/* Test ids as well as roles: Next's development overlay also renders an
          element with role="alert", so a bare role lookup is ambiguous. */}
      {error ? (
        <p role="alert" data-testid="login-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {sent && !error ? (
        <p role="status" data-testid="login-sent" className="text-sm text-content-muted">
          Check your email for a sign-in link.
        </p>
      ) : null}
    </form>
  );
}
