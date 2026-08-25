import { Button, Card } from '@expenzo/ui';
import { useSupabase } from '@expenzo/data';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../features/auth/use-session';

export default function SettingsTab() {
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
        supabase.from('profiles').select('id, display_name'),
      ]);

      if (error) throw new Error(error.message);

      const nameFor = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
      return (rows ?? []).map((row) => ({
        ...row,
        displayName: nameFor.get(row.user_id) ?? 'Member',
      }));
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 gap-gutter p-gutter">
        <Text className="text-2xl font-bold text-content">
          {household.data?.name ?? 'Settings'}
        </Text>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">Members</Text>

          {members.isPending ? (
            <ActivityIndicator />
          ) : (
            (members.data ?? []).map((member) => (
              <View key={member.user_id} className="flex-row justify-between">
                <Text testID="member-name" className="text-content">
                  {member.displayName}
                </Text>
                <Text className="text-sm text-content-muted">{member.role}</Text>
              </View>
            ))
          )}
        </Card>

        <Card className="gap-gutter">
          <Text className="text-lg font-semibold text-content">Categories</Text>
          <Button
            testID="open-categories"
            variant="secondary"
            onPress={() => router.push('/categories')}
          >
            Manage categories
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
