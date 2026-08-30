import {
  useAvatarUrls,
  useCurrentHousehold,
  useHouseholdMembers,
  useInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useSetMemberRole,
} from '@expenzo/data';
import { canManageMembers } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, Card } from '@expenzo/ui';
import { router } from 'expo-router';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../features/auth/use-session';
import { MemberList, type MemberRow } from '../features/household/member-list';
import { PendingInvitations } from '../features/household/pending-invitations';

/**
 * Who is in the household, who has been asked, and the button that asks.
 *
 * Pushed from Settings rather than given a tab: it is configuration, like the
 * categories screen next to it.
 */
export default function HouseholdScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  const members = useHouseholdMembers(householdId);
  const invitations = useInvitations(householdId);
  const avatars = useAvatarUrls((members.data ?? []).map((member) => member.avatarPath));

  const setRole = useSetMemberRole(householdId);
  const remove = useRemoveMember(householdId);
  const revoke = useRevokeInvitation(householdId);

  // What the reader may do, read off their own membership. The database
  // refuses a child regardless; this only governs what is offered.
  const me = (members.data ?? []).find((member) => member.userId === session?.user.id);
  const canManage = canManageMembers(me?.role);

  const rows: MemberRow[] = (members.data ?? []).map((member) => ({
    userId: member.userId,
    name: member.displayName,
    role: member.role,
    avatarUrl: member.avatarPath ? (avatars.data?.get(member.avatarPath) ?? null) : null,
  }));

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="gap-gutter p-gutter">
        <Card className="gap-gutter">
          {/* The button sits in the roster's own header rather than under a
              card of its own: adding a person to this list is what the list
              is for. */}
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-lg font-semibold text-content">{t('household.members')}</Text>

            {canManage ? (
              <Button
                testID="open-invite"
                size="sm"
                onPress={() => router.push('/household/invite')}
              >
                {t('household.invite')}
              </Button>
            ) : null}
          </View>

          {members.isPending ? (
            <ActivityIndicator />
          ) : (
            <MemberList
              rows={rows}
              canManage={canManage}
              onRoleChange={(change) => setRole.mutateAsync(change)}
              onRemove={(member) => remove.mutateAsync(member)}
            />
          )}
        </Card>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('household.pending')}</Text>
          <PendingInvitations
            rows={invitations.data ?? []}
            canManage={canManage}
            onRevoke={(id) => revoke.mutateAsync(id)}
          />
          <Text className="text-xs text-content-muted">{t('household.manageExplainer')}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
