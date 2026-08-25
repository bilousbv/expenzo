import Link from 'next/link';

import { Dashboard } from '@/features/dashboard/dashboard';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Dashboard · Expenzo' };

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <h1 className="text-3xl font-bold text-content">Expenzo</h1>
        <div className="flex flex-row gap-3">
          <Link href="/settings/limits" className="text-sm text-brand-600 underline">
            Limits
          </Link>
          <Link href="/settings/household" className="text-sm text-brand-600 underline">
            Settings
          </Link>
        </div>
      </div>

      {/* The user id comes from the server, where the token has already been
          revalidated, rather than from a second client-side round trip. */}
      <Dashboard userId={user?.id} />
    </main>
  );
}
