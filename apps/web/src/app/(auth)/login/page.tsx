'use client';

import { Card } from '@expenzo/ui';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import { LoginForm } from '@/features/auth/login-form';
import { createClient } from '@/lib/supabase/browser';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/';

  async function sendMagicLink(email: string) {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  return <LoginForm onSubmit={sendMagicLink} />;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">Sign in to Expenzo</h1>
        <p className="text-sm text-content-muted">
          We will email you a link. No password to remember.
        </p>

        {/* useSearchParams needs a Suspense boundary to stay statically renderable. */}
        <Suspense fallback={null}>
          <LoginContent />
        </Suspense>
      </Card>
    </main>
  );
}
