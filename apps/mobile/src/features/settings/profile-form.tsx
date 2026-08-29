import type { ProfileRow } from '@expenzo/data';
import { updateProfileInput, VALIDATION_PARAMS, type UpdateProfileInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, CurrencySelect, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';

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

  const [firstName, setFirstName] = useState(profile.firstName ?? '');
  const [lastName, setLastName] = useState(profile.lastName ?? '');
  /*
   * Null is stored, but a picker cannot show an absence. The household's own
   * currency stands in for it, so the control always shows a real answer to
   * "what am I reading in" rather than an empty slot.
   */
  const [currency, setCurrency] = useState(profile.displayCurrency ?? baseCurrency);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSave() {
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
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">{t('profile.firstName')}</Text>
      <TextInput
        testID="profile-first-name"
        value={firstName}
        onChangeText={setFirstName}
        autoComplete="given-name"
        className={fieldInputClass()}
      />

      <Text className="text-sm font-medium text-content-muted">{t('profile.lastName')}</Text>
      <TextInput
        testID="profile-last-name"
        value={lastName}
        onChangeText={setLastName}
        autoComplete="family-name"
        className={fieldInputClass()}
      />

      <CurrencySelect
        testID="display-currency"
        label={t('profile.displayCurrency')}
        currencies={currencies}
        value={currency}
        onChange={setCurrency}
      />
      <Text className="text-xs text-content-muted">{t('profile.displayCurrencyExplainer')}</Text>

      <Button testID="profile-save" disabled={pending} onPress={handleSave}>
        {pending ? t('profile.saving') : t('profile.save')}
      </Button>

      {error ? (
        <Text testID="profile-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}

      {saved && !error ? (
        <Text testID="profile-saved" className="text-sm text-positive">
          {t('profile.saved')}
        </Text>
      ) : null}
    </View>
  );
}
