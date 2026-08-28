import { ProfilePanel } from '@/features/settings/profile-panel';
import { getTranslations } from '@/lib/i18n/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.profile') };
}

export default function ProfilePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-gutter p-gutter">
      <ProfilePanel />
    </main>
  );
}
