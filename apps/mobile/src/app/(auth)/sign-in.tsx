import { Card } from '@expenzo/ui';
import { Link } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthPanel } from '../../features/auth/auth-panel';

// Closes any lingering auth browser session left over from a previous attempt.
WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="flex-grow justify-center p-gutter">
        <Card className="gap-gutter">
          <Text className="text-2xl font-bold text-content">Sign in to Expenzo</Text>

          <AuthPanel mode="signIn" />

          <View className="flex-row justify-center gap-1">
            <Text className="text-sm text-content-muted">No account yet?</Text>
            <Link href="/register" testID="go-to-register" className="text-sm text-brand-600">
              Create one
            </Link>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
