'use client';

import {
  credentialsSchema,
  registrationSchema,
  SIGNUP_CURRENCIES,
  VALIDATION_PARAMS,
  type Credentials,
} from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  CurrencySelect,
  fieldInputClass,
} from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export type CredentialsMode = 'signIn' | 'signUp';

/**
 * Registering carries the start of a profile as well as the credentials.
 *
 * The name and the currency are collected here rather than after the first
 * sign-in because they are written by the signup trigger, in the same
 * transaction as the profile, the household and the membership. A second write
 * from the client would leave a half-filled account every time it failed.
 */
export interface CredentialsSubmission {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  baseCurrency?: string;
}

export interface CredentialsFormProps {
  mode: CredentialsMode;
  onSubmit: (credentials: CredentialsSubmission) => Promise<void>;
  /**
   * Filled in when the visitor arrived from an invitation.
   *
   * The invitation is addressed to one account, so signing in or registering
   * as anybody else joins the wrong person to the household. Prefilled rather
   * than fixed: somebody who has to correct it should be able to.
   */
  initialEmail?: string;
}

const LABEL_KEY: Record<CredentialsMode, { idle: string; busy: string }> = {
  signIn: { idle: 'auth.signIn', busy: 'auth.signingIn' },
  signUp: { idle: 'auth.createAccount', busy: 'auth.creatingAccount' },
};

/**
 * What to preselect in the currency picker.
 *
 * The app's default language is Ukrainian, and someone reading a Ukrainian
 * page is overwhelmingly likely to count in hryvnia. It is only a preselection
 * — the choice is right there — but it is the difference between most people
 * picking correctly and most people accepting a wrong default they cannot
 * later change.
 */
function defaultCurrencyFor(language: string): string {
  return language.startsWith('uk') ? 'UAH' : 'USD';
}

export function CredentialsForm({ mode, onSubmit, initialEmail = '' }: CredentialsFormProps) {
  const { t, i18n } = useTranslation();
  const emailId = useId();
  const passwordId = useId();
  const confirmId = useId();
  const firstNameId = useId();
  const lastNameId = useId();

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState(() => defaultCurrencyFor(i18n.language));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const registering = mode === 'signUp';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Two sign-up requests for the same address race each other, and the loser
    // comes back "User already registered" for an account the user just made.
    if (pending) return;

    setError(null);

    /*
     * The same schemas the server's rules are mirrored from, so a password the
     * browser accepts is one GoTrue accepts.
     *
     * The two modes are parsed in separate branches rather than as one
     * expression: they produce different shapes, and narrowing a union of the
     * two afterwards is more ceremony than simply building the payload where
     * its type is still known.
     *
     * Nothing here spreads `parsed.data`. In signUp mode that carries
     * confirmPassword, which is only ever compared and must never be sent.
     */
    let submission: CredentialsSubmission;

    if (registering) {
      const parsed = registrationSchema.safeParse({
        email,
        password,
        confirmPassword,
        firstName,
        // An untouched box is no surname rather than an empty one.
        lastName: lastName.trim() === '' ? undefined : lastName,
        baseCurrency,
      });

      if (!parsed.success) {
        setError(
          t(parsed.error.issues[0]?.message ?? 'auth.errors.checkDetails', VALIDATION_PARAMS),
        );
        return;
      }

      submission = {
        email: parsed.data.email,
        password: parsed.data.password,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        baseCurrency: parsed.data.baseCurrency,
      };
    } else {
      const parsed = credentialsSchema.safeParse({ email, password });

      if (!parsed.success) {
        // The schemas return translation keys rather than prose, so the whole
        // parameter set goes with every one; i18next ignores what a given
        // string does not reference, which spares this call site knowing which
        // key it is about to render.
        setError(
          t(parsed.error.issues[0]?.message ?? 'auth.errors.checkDetails', VALIDATION_PARAMS),
        );
        return;
      }

      submission = { email: parsed.data.email, password: parsed.data.password };
    }

    setPending(true);
    try {
      await onSubmit(submission);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('auth.errors.signInFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      {registering ? (
        <>
          <label htmlFor={firstNameId} className="text-sm font-medium text-content-muted">
            {t('auth.firstName')}
          </label>
          <input
            id={firstNameId}
            name="firstName"
            autoComplete="given-name"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            aria-invalid={error ? true : undefined}
            className={fieldInputClass()}
          />

          <label htmlFor={lastNameId} className="text-sm font-medium text-content-muted">
            {t('auth.lastName')}
          </label>
          <input
            id={lastNameId}
            name="lastName"
            autoComplete="family-name"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            className={fieldInputClass()}
          />
        </>
      ) : null}

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

          <CurrencySelect
            testID="signup-currency"
            label={t('auth.baseCurrency')}
            /*
             * A fixed shortlist, not the rate table: that table is readable
             * only once signed in, and there is no session yet. Every code on
             * it is quoted by one of the two feeds.
             */
            currencies={[...SIGNUP_CURRENCIES]}
            value={baseCurrency}
            onChange={setBaseCurrency}
          />
          <p className="text-xs text-content-muted">{t('auth.baseCurrencyExplainer')}</p>
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
        <p role="alert" data-testid="credentials-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export type { Credentials };
