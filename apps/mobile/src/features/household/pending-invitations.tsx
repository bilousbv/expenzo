import { useTranslation } from '@expenzo/i18n';
import { Button } from '@expenzo/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export interface PendingInvitationsProps {
  rows: PendingInvitationRow[];
  canManage: boolean;
  onRevoke: (id: string) => Promise<void>;
}

/**
 * Who has been asked and has not arrived yet.
 *
 * Visible to the whole household — it is not a secret who was invited — but
 * withdrawing one is administration, so only an adult is offered the button.
 */
export function PendingInvitations({ rows, canManage, onRevoke }: PendingInvitationsProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Text testID="no-invitations" className="text-sm text-content-muted">
        {t('household.pendingNone')}
      </Text>
    );
  }

  async function revoke(id: string) {
    setError(null);
    setBusy(id);
    try {
      await onRevoke(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.inviteFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-gutter">
      {rows.map((row) => (
        <View key={row.id} className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text testID="invitation-email" className="text-content">
              {row.email}
            </Text>
            <Text testID="invitation-role" className="text-xs text-content-muted">
              {`${t(`household.roles.${row.role}`)} · ${t('household.expires', {
                date: new Date(row.expiresAt).toLocaleDateString(i18n.language),
              })}`}
            </Text>
          </View>

          {canManage ? (
            <Button
              testID={`invitation-revoke-${row.id}`}
              variant="ghost"
              size="sm"
              disabled={busy === row.id}
              onPress={() => void revoke(row.id)}
            >
              {t('household.revoke')}
            </Button>
          ) : null}
        </View>
      ))}

      {error ? (
        <Text testID="invitation-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
