import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Expenzo',
  description: 'Track expenses on web and mobile.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-surface-muted text-content antialiased">{children}</body>
    </html>
  );
}
