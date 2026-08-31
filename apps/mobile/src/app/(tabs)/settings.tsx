import { personDisplayName } from '@expenzo/domain';
import { Avatar, Button, Card } from '@expenzo/ui';
import { signedAvatarUrls, useSupabase } from '@expenzo/data';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useTranslation } from '@expenzo/i18n';

import { LanguageSwitcher } from '../../features/settings/language-switcher';
import { ThemeSwitcher } from '../../features/settings/theme-switcher';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../features/auth/use-session';

export default function SettingsTab() {
  const { t } = useTranslation();
  const supabase = useSupabase();
  const { session } = useSession();

  // Row-level security scopes both queries to the caller's household, so
  // neither needs a household filter of its own.
  const household = useQuery({
    queryKey: ['households', 'current'],
    queryFn: async () => {
      const { data, error } = await supabase.from('households').select('id, name').maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const members = useQuery({
    queryKey: ['households', 'members'],
    queryFn: async () => {
      const [{ data: rows, error }, { data: profiles }] = await Promise.all([
        supabase.from('household_members').select('user_id, role').eq('status', 'active'),
        supabase.from('profiles').select('id, first_name, last_name, display_name, avatar_path'),
      ]);

      if (error) throw new Error(error.message);

      // Assembled by the domain helper so this screen, the web roster and every
      // expense row cannot drift into naming one person three different ways.
      const nameFor = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          personDisplayName({
            firstName: p.first_name,
            lastName: p.last_name,
            displayName: p.display_name,
          }),
        ]),
      );
      // Signed in one request for the whole roster: the bucket is private, so
      // a usable URL cannot be stored, and one call per member would be five
      // round trips for a household of five before any face appeared.
      const urls = await signedAvatarUrls(
        supabase,
        (profiles ?? []).map((p) => p.avatar_path ?? ''),
      );
      const avatarFor = new Map(
        (profiles ?? []).map((p) => [
          p.id,
          p.avatar_path ? (urls.get(p.avatar_path) ?? null) : null,
        ]),
      );

      return (rows ?? []).map((row) => ({
        ...row,
        displayName: nameFor.get(row.user_id) ?? t('common.member'),
        avatarUrl: avatarFor.get(row.user_id) ?? null,
      }));
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 gap-gutter p-gutter">
        <Text className="text-2xl font-bold text-content">
          {household.data?.name ?? t('nav.settings')}
        </Text>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('household.members')}</Text>

          {members.isPending ? (
            <ActivityIndicator />
          ) : (
            (members.data ?? []).map((member) => (
              <View key={member.user_id} className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <Avatar name={member.displayName} url={member.avatarUrl} size="sm" />
                  <Text testID="member-name" className="text-content">
                    {member.displayName}
                  </Text>
                </View>
                <Text className="text-sm text-content-muted">
                  {t(`household.roles.${member.role}`)}
                </Text>
              </View>
            ))
          )}

          {/* Read-only here. Inviting and changing what somebody is happen on
              a screen of their own, so this tab stays a summary. */}
          <Button
            testID="open-household"
            variant="secondary"
            onPress={() => router.push('/household')}
          >
            {t('nav.manageHousehold')}
          </Button>
        </Card>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('profile.title')}</Text>
          <Button testID="open-profile" variant="secondary" onPress={() => router.push('/profile')}>
            {t('profile.title')}
          </Button>
        </Card>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('notifications.title')}</Text>
          <Button
            testID="open-notifications"
            variant="secondary"
            onPress={() => router.push('/notifications')}
          >
            {t('notifications.preferences.title')}
          </Button>
        </Card>

        <Card className="gap-gutter">
          <LanguageSwitcher />
          <ThemeSwitcher />
        </Card>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">{t('categories.title')}</Text>
          <Button
            testID="open-categories"
            variant="secondary"
            onPress={() => router.push('/categories')}
          >
            {t('nav.manageCategories')}
          </Button>
        </Card>

        <Card className="gap-gutter">
          <Text className="text-sm text-content-muted">Signed in as {session?.user.email}</Text>
          <Button
            testID="sign-out"
            variant="secondary"
            onPress={() => void supabase.auth.signOut()}
          >
            Sign out
          </Button>
        </Card>
      </View>
    </SafeAreaView>
  );
}
