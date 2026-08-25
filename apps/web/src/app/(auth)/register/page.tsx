import { Card } from '@expenzo/ui';
import { Suspense } from 'react';

import { AuthPanel } from '@/features/auth/auth-panel';

export const metadata = { title: 'Create an account · Expenzo' };

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-gutter">
      <Card className="w-full max-w-sm gap-gutter">
        <h1 className="text-2xl font-bold text-content">Create your Expenzo account</h1>
        <p className="text-sm text-content-muted">
          You get a household of your own, and can invite people to it afterwards.
        </p>

        <Suspense fallback={null}>
          <AuthPanel mode="signUp" />
        </Suspense>
      </Card>
    </main>
  );
}
