import {
  credentialsSchema,
  registrationSchema,
  SIGNUP_CURRENCIES,
  VALIDATION_PARAMS,
} from '@expenzo/domain';
import { Button, CurrencySelect, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';
import { useTranslation } from '@expenzo/i18n';
import { Text, TextInput, View } from 'react-native';

export type CredentialsMode = 'signIn' | 'signUp';

/**
 * Registering carries the start of a profile as well as the credentials.
 *
 * The name and the currency are written by the signup trigger in the same
 * transaction as the profile, the household and the membership. A second write
 * once the session exists would leave a half-filled account whenever it failed.
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
}

const LABEL: Record<CredentialsMode, { idle: string; busy: string }> = {
  signIn: { idle: 'auth.signIn', busy: 'auth.signingIn' },
  signUp: { idle: 'auth.createAccount', busy: 'auth.creatingAccount' },
};

/**
 * What to preselect in the currency picker.
 *
 * The app's default language is Ukrainian, and someone reading a Ukrainian
 * screen is overwhelmingly likely to count in hryvnia. Only a preselection —
 * but the base currency cannot be changed later, so the default matters.
 */
function defaultCurrencyFor(language: string): string {
  return language.startsWith('uk') ? 'UAH' : 'USD';
}

export function CredentialsForm({ mode, onSubmit }: CredentialsFormProps) {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [baseCurrency, setBaseCurrency] = useState(() => defaultCurrencyFor(i18n.language));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const registering = mode === 'signUp';

  async function handleSubmit() {
    // A fast double tap lands two presses before the re-render, and two sign-up
    // requests for one address race — the loser comes back "User already
    // registered" for an account the user just made themselves.
    if (pending) return;

    setError(null);

    /*
     * The same schemas the web app validates against, so the two clients
     * cannot disagree about what a password is.
     *
     * Parsed in two branches rather than one expression: the modes produce
     * different shapes, and narrowing a union afterwards is more ceremony than
     * building the payload where its type is still known. Nothing here spreads
     * `parsed.data` — in signUp mode it carries confirmPassword, which is only
     * ever compared and must never be sent.
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
    <View className="gap-gutter">
      {registering ? (
        <>
          <Text className="text-sm font-medium text-content-muted">{t('auth.firstName')}</Text>
          <TextInput
            testID="credentials-first-name"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            className={fieldInputClass()}
          />

          <Text className="text-sm font-medium text-content-muted">{t('auth.lastName')}</Text>
          <TextInput
            testID="credentials-last-name"
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            className={fieldInputClass()}
          />
        </>
      ) : null}

      <Text className="text-sm font-medium text-content-muted">{t('auth.email')}</Text>
      <TextInput
        testID="credentials-email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder={t('auth.emailPlaceholder')}
        className={fieldInputClass()}
      />

      <Text className="text-sm font-medium text-content-muted">{t('auth.password')}</Text>
      <TextInput
        testID="credentials-password"
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        // Tells the OS password manager which kind of password this is, so it
        // offers to save a new one rather than filling the wrong existing one.
        autoComplete={registering ? 'new-password' : 'current-password'}
        secureTextEntry
        className={fieldInputClass()}
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
            className={fieldInputClass()}
          />

          <CurrencySelect
            testID="signup-currency"
            label={t('auth.baseCurrency')}
            /* A fixed shortlist, not the rate table: that table is readable
               only once signed in, and there is no session yet. */
            currencies={[...SIGNUP_CURRENCIES]}
            value={baseCurrency}
            onChange={setBaseCurrency}
          />
          <Text className="text-xs text-content-muted">{t('auth.baseCurrencyExplainer')}</Text>
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
