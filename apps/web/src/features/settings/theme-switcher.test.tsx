import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeSwitcher } from './theme-switcher';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/theme-action', () => ({ setTheme: vi.fn().mockResolvedValue(undefined) }));

describe('ThemeSwitcher', () => {
  it('offers both schemes', () => {
    render(<ThemeSwitcher theme="dark" />);

    expect(screen.getByRole('option', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /light/i })).toBeInTheDocument();
  });

  // The control has to show the scheme actually in force, which the server
  // read from the cookie — not a guess made in the browser.
  it('shows the scheme currently in force', () => {
    render(<ThemeSwitcher theme="light" />);

    expect(screen.getByTestId('theme-select')).toHaveValue('light');
  });
});
