'use client';

import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LoginFormProps {
  onSubmit: (email: string) => Promise<void>;
}

export function LoginForm({ onSubmit }: LoginFormProps) {
  const { t } = useTranslation();
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
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    // Sending twice invalidates the first link, which reads to the user as
    // "the link is broken".
    setPending(true);
    try {
      await onSubmit(trimmed);
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth.errors.sendLinkFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={emailId} className="text-sm font-medium text-content-muted">
        {t('auth.email')}
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
        className={fieldInputClass()}
        placeholder={t('auth.emailPlaceholder')}
      />

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'auth.sendingMagicLink' : 'auth.sendMagicLink')}
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
          {t('auth.magicLinkSent')}
        </p>
      ) : null}
    </form>
  );
}
