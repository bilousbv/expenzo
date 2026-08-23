'use client';

import { useState } from 'react';
import { Button, Card, formatCurrency } from '@expenzo/ui';

export default function Home() {
  const [totalCents, setTotalCents] = useState(0);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-gutter p-gutter">
      <h1 className="text-3xl font-bold">Expenzo</h1>

      <Card className="gap-gutter">
        <p className="text-sm text-content-muted">Total spent</p>
        <p className="text-4xl font-semibold">{formatCurrency(totalCents)}</p>
      </Card>

      <div className="flex gap-3">
        <Button onPress={() => setTotalCents((cents) => cents + 1250)}>Add $12.50</Button>
        <Button variant="secondary" onPress={() => setTotalCents(0)}>
          Reset
        </Button>
      </div>
    </main>
  );
}
