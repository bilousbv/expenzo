'use client';

import { personDisplayName, type UpdateProfileInput } from '@expenzo/domain';
import {
  useClearMyAvatar,
  useCurrentHousehold,
  useMyAvatarUrl,
  useMyProfile,
  useSetMyAvatar,
  useSupportedCurrencies,
  useUpdateMyProfile,
} from '@expenzo/data';
import { useTranslation } from '@expenzo/i18n';
import { Card } from '@expenzo/ui';

import { AvatarField } from './avatar-field';
import { ProfileForm } from './profile-form';

/**
 * Wires the profile form to the database, so the form stays presentational.
 *
 * The currency list is the rate table rather than the registration shortlist:
 * by now there is a session, so the app can offer exactly what it is able to
 * convert. Offering more than that would produce a choice that silently fails
 * to apply.
 */
export function ProfilePanel() {
  const { t } = useTranslation();
  const profile = useMyProfile();
  const household = useCurrentHousehold();
  const baseCurrency = household.data?.base_currency ?? 'USD';
  const currencies = useSupportedCurrencies(household.data?.base_currency);
  const save = useUpdateMyProfile();
  const avatarUrl = useMyAvatarUrl();
  const setAvatar = useSetMyAvatar();
  const clearAvatar = useClearMyAvatar();

  if (!profile.data || !household.data) {
    return <p className="text-sm text-content-muted">{t('common.loading')}</p>;
  }

  async function handleSave(input: UpdateProfileInput) {
    await save.mutateAsync(input);
  }

  return (
    <Card className="gap-gutter">
      <h1 className="text-2xl font-bold text-content">{t('profile.title')}</h1>
      <p className="text-sm text-content-muted">{t('profile.explainer')}</p>

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
    </Card>
  );
}
