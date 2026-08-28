import {
  useClearMyAvatar,
  useCurrentHousehold,
  useMyAvatarUrl,
  useMyProfile,
  useSetMyAvatar,
  useSupportedCurrencies,
  useUpdateMyProfile,
} from '@expenzo/data';
import { personDisplayName, type UpdateProfileInput } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card } from '@expenzo/ui';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvatarField } from '../features/settings/avatar-field';
import { ProfileForm } from '../features/settings/profile-form';

/**
 * A member's own name and reading currency.
 *
 * The currency list is the rate table rather than the registration shortlist:
 * by now there is a session, so the screen can offer exactly what the database
 * is able to convert.
 */
export default function ProfileScreen() {
  const { t } = useTranslation();
  const profile = useMyProfile();
  const household = useCurrentHousehold();
  const baseCurrency = household.data?.base_currency ?? 'USD';
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const save = useUpdateMyProfile();
  const avatarUrl = useMyAvatarUrl();
  const setAvatar = useSetMyAvatar();
  const clearAvatar = useClearMyAvatar();

  async function handleSave(input: UpdateProfileInput) {
    await save.mutateAsync(input);
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-muted">
      <ScrollView contentContainerClassName="p-gutter">
        <Card className="gap-gutter">
          <Text className="text-sm text-content-muted">{t('profile.explainer')}</Text>

          {!profile.data || !household.data ? (
            <ActivityIndicator />
          ) : (
            <>
              <AvatarField
                name={personDisplayName(profile.data)}
                url={avatarUrl}
                onChoose={(file) => setAvatar.mutateAsync(file).then(() => undefined)}
                onRemove={() => clearAvatar.mutateAsync().then(() => undefined)}
              />

              <ProfileForm
                profile={profile.data}
                baseCurrency={baseCurrency}
                currencies={currencies.data ?? [baseCurrency]}
                onSave={handleSave}
              />
            </>
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
