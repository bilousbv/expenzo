import { invitableRoleSchema, inviteInput, type InvitableRole } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

export interface InviteSubmission {
  email: string;
  role: InvitableRole;
}

export interface InviteFormProps {
  onInvite: (submission: InviteSubmission) => Promise<void>;
  disabled?: boolean;
}

/**
 * Asking somebody to join, and saying what they will be when they do.
 *
 * The token no longer comes back here — `send-invitation` puts it in an email —
 * so all this ever learns is that the send worked.
 */
export function InviteForm({ onInvite, disabled = false }: InviteFormProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('adult');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setError(null);

    // The same schema the repository parses with, so a bad address is caught
    // here rather than at the far end of a round trip.
    const parsed = inviteInput.safeParse({ email, role });

    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? 'validation.email.invalid'));
      return;
    }

    setPending(true);
    try {
      await onInvite({ email: parsed.data.email, role: parsed.data.role });
      setSentTo(parsed.data.email);
      setEmail('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.inviteFailed'));
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <View className="gap-gutter">
        <Text testID="invite-sent" className="text-sm text-content">
          {t('household.sent', { email: sentTo })}
        </Text>
        <Text className="text-sm text-content-muted">{t('household.sentExplainer')}</Text>
        <Button testID="invite-again" variant="secondary" onPress={() => setSentTo(null)}>
          {t('household.inviteSomeone')}
        </Button>
      </View>
    );
  }

  return (
    <View className="gap-gutter">
      <Text className="text-sm font-medium text-content-muted">{t('auth.email')}</Text>

      <TextInput
        testID="invite-email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder={t('household.emailPlaceholder')}
        className={fieldInputClass()}
      />

      {/* Two rows rather than a picker: each needs a sentence of explanation,
          and the explanation is the point — "child" is a set of permissions,
          not an age. */}
      <Text className="text-sm font-medium text-content-muted">{t('household.joiningAs')}</Text>

      {invitableRoleSchema.options.map((option) => (
        <Pressable
          key={option}
          testID={`invite-role-${option}`}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === option }}
          onPress={() => setRole(option)}
          className="flex-row items-start gap-3 rounded-card border border-border p-3"
        >
          <View
            className={`mt-1 h-4 w-4 rounded-full border ${
              role === option ? 'border-accent bg-accent' : 'border-border'
            }`}
          />
          <View className="flex-1">
            <Text className="text-sm text-content">{t(`household.roles.${option}`)}</Text>
            <Text className="text-xs text-content-muted">
              {t(`household.roleExplainer.${option}`)}
            </Text>
          </View>
        </Pressable>
      ))}

      <Button testID="invite-submit" disabled={pending || disabled} onPress={() => void submit()}>
        {t(pending ? 'household.inviting' : 'household.invite')}
      </Button>

      {error ? (
        <Text testID="invite-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
