import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <View className="flex-1 items-center justify-center p-gutter">
        <Text className="text-xl font-semibold text-content">This screen does not exist.</Text>
        <Link href="/" className="mt-4 text-brand-600">
          Go to the expense list
        </Link>
      </View>
    </>
  );
}
