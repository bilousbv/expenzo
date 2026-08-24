import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { createClient } from '@/lib/supabase/server';

/**
 * Guards everything inside the (app) route group.
 *
 * getUser rather than getSession: it revalidates the token against the auth
 * server instead of trusting a cookie the browser could have been handed.
 *
 * This is defence in depth rather than the actual security boundary — that is
 * row-level security in the database. A redirect only decides what the UI
 * shows; the data is unreachable regardless.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return <>{children}</>;
}
