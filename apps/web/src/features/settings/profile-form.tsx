'use client';

import { updateProfileInput, VALIDATION_PARAMS, type UpdateProfileInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import {
  buttonContainerClass,
  buttonLabelClass,
  CurrencySelect,
  fieldInputClass,
} from '@expenzo/ui';
import type { ProfileRow } from '@expenzo/data';
import { useId, useState, type FormEvent } from 'react';

export interface ProfileFormProps {
  profile: ProfileRow;
  /** What the household records in, and the default this member reads in. */
  baseCurrency: string;
  currencies: string[];
  onSave: (input: UpdateProfileInput) => Promise<void>;
}

/**
 * A member's own name and the currency they read household figures in.
 *
 * Nothing here is required. A magic-link account was never asked for a name, so
 * refusing to save without one would lock those people out of changing their
 * currency — the display falls back to what the signup trigger derived.
 */
export function ProfileForm({ profile, baseCurrency, currencies, onSave }: ProfileFormProps) {
  const { t } = useTranslation();
  const firstNameId = useId();
  const lastNameId = useId();

  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  /*
   * Null is stored, but a select cannot show an absence. The household's own
   * currency stands in for it, so the control always shows a real answer to
   * "what am I reading in" rather than an empty slot.
   */
  const [currency, setCurrency] = useState(profile.displayCurrency ?? baseCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (pending) return;

    setError(null);
    setSaved(false);

    const parsed = updateProfileInput.safeParse({
      firstName,
      lastName,
      /*
       * Choosing the household's currency is stored as no choice at all.
       * Storing the code would freeze it: if the household's ever differed,
       * this member would silently keep the old one.
       */
      displayCurrency: currency === baseCurrency ? null : currency,
    });

    if (!parsed.success) {
      // The schemas return translation keys rather than prose, so the whole
      // parameter set goes with every one; i18next ignores what a given string
      // does not reference.
      setError(t(parsed.error.issues[0]?.message ?? 'profile.saveFailed', VALIDATION_PARAMS));
      return;
    }

    setPending(true);
    try {
      await onSave(parsed.data);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('profile.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={firstNameId} className="text-sm font-medium text-content-muted">
        {t('profile.firstName')}
      </label>
      <input
        id={firstNameId}
        name="firstName"
        autoComplete="given-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
        className={fieldInputClass()}
      />

      <label htmlFor={lastNameId} className="text-sm font-medium text-content-muted">
        {t('profile.lastName')}
      </label>
      <input
        id={lastNameId}
        name="lastName"
        autoComplete="family-name"
        value={lastName}
        onChange={(event) => setLastName(event.target.value)}
        className={fieldInputClass()}
      />

      <CurrencySelect
        testID="display-currency"
        label={t('profile.displayCurrency')}
        currencies={currencies}
        value={currency}
        onChange={setCurrency}
      />
      <p className="text-xs text-content-muted">{t('profile.displayCurrencyExplainer')}</p>

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'profile.saving' : 'profile.save')}
        </span>
      </button>

      {/* Test ids as well as roles: Next's development overlay also renders an
          element with role="alert", so a bare role lookup is ambiguous. */}
      {error ? (
        <p role="alert" data-testid="profile-error" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      {saved && !error ? (
        <p data-testid="profile-saved" className="text-sm text-positive">
          {t('profile.saved')}
        </p>
      ) : null}
    </form>
  );
}
