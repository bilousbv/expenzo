import { Dashboard } from '@/features/dashboard/dashboard';
import { getTranslations } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

export async function generateMetadata() {
  const { t } = await getTranslations();

  return { title: t('pageTitle.dashboard') };
}

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col">
      {/* The user id comes from the server, where the token has already been
          revalidated, rather than from a second client-side round trip. */}
      <Dashboard userId={user?.id} />
    </main>
  );
}
