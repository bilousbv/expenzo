'use client';

import {
  credentialsSchema,
  registrationSchema,
  VALIDATION_PARAMS,
  type Credentials,
} from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export type CredentialsMode = 'signIn' | 'signUp';

export interface CredentialsFormProps {
  mode: CredentialsMode;
  onSubmit: (credentials: { email: string; password: string }) => Promise<void>;
}

const LABEL_KEY: Record<CredentialsMode, { idle: string; busy: string }> = {
  signIn: { idle: 'auth.signIn', busy: 'auth.signingIn' },
  signUp: { idle: 'auth.createAccount', busy: 'auth.creatingAccount' },
};

export function CredentialsForm({ mode, onSubmit }: CredentialsFormProps) {
  const { t } = useTranslation();
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
      // The schemas return translation keys rather than prose, so the whole
      // parameter set goes with every one; i18next ignores what a given string
      // does not reference, which spares this call site knowing which key it
      // is about to render.
      setError(t(parsed.error.issues[0]?.message ?? 'auth.errors.checkDetails', VALIDATION_PARAMS));
      return;
    }

    setPending(true);
    try {
      // Deliberately not spreading `parsed.data`: in signUp mode that carries
      // confirmPassword, which is only ever compared and must not be sent.
      await onSubmit({ email: parsed.data.email, password: parsed.data.password });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth.errors.signInFailed'));
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
        placeholder={t('auth.emailPlaceholder')}
        className={fieldInputClass()}
      />

      <label htmlFor={passwordId} className="text-sm font-medium text-content-muted">
        {t('auth.password')}
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
        className={fieldInputClass()}
      />

      {registering ? (
        <>
          <label htmlFor={confirmId} className="text-sm font-medium text-content-muted">
            {t('auth.confirmPassword')}
          </label>
          <input
            id={confirmId}
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            className={fieldInputClass()}
          />
        </>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? LABEL_KEY[mode].busy : LABEL_KEY[mode].idle)}
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
