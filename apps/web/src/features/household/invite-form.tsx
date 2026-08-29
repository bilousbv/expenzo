'use client';

import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteFormProps {
  /** Returns the one-time invitation token. */
  onInvite: (email: string) => Promise<string>;
  origin: string;
}

export function InviteForm({ onInvite, origin }: InviteFormProps) {
  const { t } = useTranslation();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const trimmed = email.trim();
    setError(null);

    if (!EMAIL_PATTERN.test(trimmed)) {
      setError(t('auth.errors.invalidEmail'));
      return;
    }

    setPending(true);
    try {
      setToken(await onInvite(trimmed));
      setEmail('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.inviteFailed'));
    } finally {
      setPending(false);
    }
  }

  if (token) {
    const link = `${origin}/invite/${token}`;

    return (
      <div className="flex flex-col gap-gutter">
        <p className="text-sm text-content-muted">{t('household.linkExplainer')}</p>

        <code
          data-testid="invite-link"
          className="break-all rounded-card bg-surface-muted px-4 py-3 text-sm text-content"
        >
          {link}
        </code>

        {/* The token is a bearer credential: anyone with the link can join, so
            it should not sit on screen after it has been handed over. */}
        <button
          type="button"
          onClick={() => setToken(null)}
          className={buttonContainerClass('secondary', 'md')}
        >
          <span className={buttonLabelClass('secondary', 'md')}>{t('common.done')}</span>
        </button>
      </div>
    );
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
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={fieldInputClass()}
        placeholder={t('household.emailPlaceholder')}
      />

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'household.inviting' : 'household.invite')}
        </span>
      </button>

      {error ? (
        <p role="alert" data-testid="invite-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}
