import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppHeader } from './app-header';

describe('AppHeader', () => {
  /*
   * Until now this lived inside the dashboard's gradient panel, which meant it
   * existed on exactly one page: every settings screen was a dead end you could
   * only leave with the browser's back button.
   */
  it('links to every part of the app', () => {
    render(<AppHeader />);

    const nav = screen.getByRole('navigation');

    expect(nav.querySelector('a[href="/"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/subscriptions"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/limits"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/household"]')).not.toBeNull();
    expect(nav.querySelector('a[href="/settings/profile"]')).not.toBeNull();
  });

  // The name is the way back to the dashboard from anywhere.
  it('makes the app name a link home', () => {
    render(<AppHeader />);

    expect(screen.getByRole('link', { name: 'Expenzo' })).toHaveAttribute('href', '/');
  });

  /*
   * One landmark per page. The header is the site-wide navigation, so it is
   * what a screen reader should offer when asked for the nav.
   */
  it('is a navigation landmark', () => {
    render(<AppHeader />);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
