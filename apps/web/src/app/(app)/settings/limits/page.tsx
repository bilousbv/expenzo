import Link from 'next/link';

import { LimitManager } from '@/features/limits/limit-manager';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Limits · Expenzo' };

export default async function LimitsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-gutter p-gutter">
      <div className="flex flex-row items-baseline justify-between">
        <h1 className="text-3xl font-bold text-content">Spending limits</h1>
        <Link href="/" className="text-sm text-brand-600 underline">
          Dashboard
        </Link>
      </div>

      <LimitManager userId={user?.id} />
    </main>
  );
}
