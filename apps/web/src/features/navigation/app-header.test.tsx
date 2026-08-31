import { SupabaseProvider } from '@expenzo/data';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from './app-header';

/**
 * The header carries the alerts link, which reads what is waiting, so it needs
 * the providers the app gives it. A stub that answers "no household" is enough:
 * every other query is keyed on the household and stays disabled without one,
 * which is exactly what the header does on a page rendered before the session
 * has settled.
 */
function stubDb() {
  const builder = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    order: () => builder,
    limit: () => builder,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    single: () => Promise.resolve({ data: null, error: null }),
    then: (resolve: (value: { data: null; error: null }) => unknown) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
  };

  return {
    from: vi.fn(() => builder),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  };
}

function renderHeader() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SupabaseProvider client={stubDb() as never}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </SupabaseProvider>
    );
  }

  return render(<AppHeader />, { wrapper: Wrapper });
}

describe('AppHeader', () => {
  /*
   * Until now this lived inside the dashboard's gradient panel, which meant it
   * existed on exactly one page: every settings screen was a dead end you could
   * only leave with the browser's back button.
   */
  it('links to every part of the app', () => {
    renderHeader();

    const nav = screen.getByRole('navigation');

    expect(nav.querySelector('a[href="/"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/subscriptions"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/limits"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/household"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/profile"]')).not.toBeNull();
  });

  /*
   * The alerts link lives here rather than on the dashboard, because draining
   * the queue happens wherever it is rendered — a notification that only came
   * into existence once you visited the page listing notifications would be no
   * use at all.
   */
  it('links to the notification centre from every page', () => {
    renderHeader();

    expect(screen.getByTestId('go-to-notifications')).toHaveAttribute('href', '/notifications');
  });

  // Nothing waiting, no badge. A zero is noise on a control that is already
  // there to be looked at.
  it('shows no unread badge when there is nothing waiting', () => {
    renderHeader();

    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  // The name is the way back to the dashboard from anywhere.
  it('makes the app name a link home', () => {
    renderHeader();

    expect(screen.getByRole('link', { name: 'Expenzo' })).toHaveAttribute('href', '/');
  });

  /*
   * One landmark per page. The header is the site-wide navigation, so it is
   * what a screen reader should offer when asked for the nav.
   */
  it('is a navigation landmark', () => {
    renderHeader();

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
