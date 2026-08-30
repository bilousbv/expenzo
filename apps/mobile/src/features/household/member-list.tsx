import { invitableRoleSchema, type MemberRole } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Avatar, Button } from '@expenzo/ui';
import { useState } from 'react';
import { Text, View } from 'react-native';

export interface MemberRow {
  userId: string;
  name: string;
  role: MemberRole;
  avatarUrl: string | null;
}

export interface MemberListProps {
  rows: MemberRow[];
  /** Whether the reader is an owner or an adult. */
  canManage: boolean;
  onRoleChange: (change: { member: string; role: MemberRole }) => Promise<void>;
  onRemove: (member: string) => Promise<void>;
}

/**
 * The roster, with the two things an adult can do to it.
 *
 * The role is two buttons rather than a picker: there are two to choose from,
 * and a modal list to pick one of two is more ceremony than the choice.
 *
 * The owner's row carries neither control — the database refuses both, since
 * their membership is what `households.owner_id` points at.
 */
export function MemberList({ rows, canManage, onRoleChange, onRemove }: MemberListProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(member: string, action: () => Promise<void>) {
    setError(null);
    setBusy(member);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.roleFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="gap-gutter">
      {rows.map((row) => {
        const owner = row.role === 'owner';

        return (
          <View key={row.userId} className="gap-2">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Avatar name={row.name} url={row.avatarUrl} size="sm" />
                <Text testID="member-name" className="text-content">
                  {row.name}
                </Text>
              </View>

              {canManage && !owner ? (
                <Button
                  testID={`member-remove-${row.userId}`}
                  variant="ghost"
                  size="sm"
                  disabled={busy === row.userId}
                  onPress={() => void run(row.userId, () => onRemove(row.userId))}
                >
                  {t('household.remove')}
                </Button>
              ) : (
                <Text testID="member-role" className="text-sm text-content-muted">
                  {t(`household.roles.${row.role}`)}
                </Text>
              )}
            </View>

            {canManage && !owner ? (
              <View
                accessibilityRole="radiogroup"
                accessibilityLabel={t('household.joiningAs')}
                className="flex-row gap-2"
              >
                {invitableRoleSchema.options.map((option) => (
                  <Button
                    key={option}
                    testID={`member-role-${row.userId}-${option}`}
                    variant={row.role === option ? 'primary' : 'secondary'}
                    size="sm"
                    disabled={busy === row.userId}
                    onPress={() =>
                      void run(row.userId, () => onRoleChange({ member: row.userId, role: option }))
                    }
                  >
                    {t(`household.roles.${option}`)}
                  </Button>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}

      {/* Rendered for everyone rather than only on a refusal: it explains an
          absence, and an absence has no moment at which to announce itself. */}
      <Text className="text-xs text-content-muted">{t('household.ownerNote')}</Text>

      {error ? (
        <Text testID="member-error" className="text-sm text-negative">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
