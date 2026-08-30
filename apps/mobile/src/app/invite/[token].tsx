import { acceptInvitation, previewInvitation, useSupabase } from '@expenzo/data';
import { inviteMode } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Button, Card } from '@expenzo/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '../../features/auth/use-session';
import { setPendingInvite } from '../../features/household/pending-invite';

/**
 * Redeeming an invitation on the phone.
 *
 * This is where `expenzo://invite/<token>` lands, and where the web page hands
 * off to when the link is opened in a mobile browser. Registered outside both
 * of the navigator's guards, like the auth callback: the visitor it exists for
 * is exactly the one who may not be signed in yet.
 */
export default function AcceptInviteScreen() {
  const { t } = useTranslation();
  const db = useSupabase();
  const { session, loading } = useSession();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  /**
   * The token this screen has already spent, if any.
   *
   * Redeeming is one-shot against a one-shot token, and this effect re-runs
   * whenever the session object changes — which it does on every token
   * refresh. The second call is the database correctly refusing a link the
   * first call spent, so without this the person who just joined is told the
   * invitation had already been used.
   */
  const redeemed = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !token) return;

    let cancelled = false;

    async function run() {
      // Previewable without a session — the function is granted to `anon` —
      // which is what lets this tell an existing account from a new one.
      const preview = await previewInvitation(db, token);
      if (cancelled) return;

      const mode = inviteMode({
        known: Boolean(preview),
        signedIn: Boolean(session),
        accountExists: preview?.accountExists ?? false,
      });

      if (mode === 'invalid') {
        setError(t('invite.failed'));
        return;
      }

      if (mode === 'accept') {
        if (redeemed.current === token) return;
        redeemed.current = token;

        await acceptInvitation(db, token);
        setJoined(true);
        return;
      }

      // Parked so the token survives the navigator swapping trees, and the
      // address travels so nobody signs in as the wrong person.
      setPendingInvite(token);
      router.replace({
        pathname: mode === 'signIn' ? '/sign-in' : '/register',
        params: { email: preview?.email ?? '' },
      });
    }

    void run().catch((cause: unknown) => {
      if (!cancelled) setError(cause instanceof Error ? cause.message : t('invite.failed'));
    });

    return () => {
      cancelled = true;
    };
  }, [db, loading, session, t, token]);

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <View className="flex-1 items-center justify-center p-gutter">
        <Card className="w-full gap-gutter">
          {error ? (
            <>
              <Text className="text-2xl font-bold text-content">{t('invite.failed')}</Text>
              <Text testID="invite-error" className="text-sm text-negative">
                {error}
              </Text>
              <Text className="text-sm text-content-muted">{t('invite.explainer')}</Text>
            </>
          ) : joined ? (
            <>
              <Text testID="invite-accepted" className="text-2xl font-bold text-content">
                {t('household.joined')}
              </Text>
              <Text className="text-sm text-content-muted">{t('household.joinedExplainer')}</Text>
              <Button testID="go-to-expenses" onPress={() => router.replace('/')}>
                {t('nav.goToExpenses')}
              </Button>
            </>
          ) : (
            <ActivityIndicator />
          )}
        </Card>
      </View>
    </SafeAreaView>
  );
}
