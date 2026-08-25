import { Card } from '@expenzo/ui';
import { Suspense } from 'react';

import { AuthPanel } from '@/features/auth/auth-panel';

export const metadata = { title: 'Sign in · Expenzo' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">Sign in to Expenzo</h1>

        {/* useSearchParams needs a Suspense boundary to stay statically renderable. */}
        <Suspense fallback={null}>
          <AuthPanel mode="signIn" />
        </Suspense>
      </Card>
    </main>
  );
}
