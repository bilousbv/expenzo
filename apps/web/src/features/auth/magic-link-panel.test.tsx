import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const signInWithOtp = vi.fn();

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ auth: { signInWithOtp } }),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

import { MagicLinkPanel } from './magic-link-panel';

async function askForALink(email = 'ana@example.com') {
  render(<MagicLinkPanel />);

  await userEvent.type(screen.getByLabelText(/email/i), email);
  await userEvent.click(screen.getByRole('button', { name: /send.*link/i }));
}

describe('MagicLinkPanel', () => {
  /*
   * The whole point of the change: a link signs an existing account in and
   * never quietly mints a new one. Left at GoTrue's default, a typo in the
   * address creates a second empty household and the person sees an app with
   * none of their data in it.
   */
  it('refuses to create an account on the way in', async () => {
    signInWithOtp.mockResolvedValue({ error: null });

    await askForALink();

    expect(signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@example.com',
        options: expect.objectContaining({ shouldCreateUser: false }),
      }),
    );
  });

  it('confirms once the link is on its way', async () => {
    signInWithOtp.mockResolvedValue({ error: null });

    await askForALink();

    expect(screen.getByTestId('login-sent')).toBeInTheDocument();
  });

  // GoTrue's own wording for this is "Signups not allowed for otp", which is
  // written for whoever wrote the API call rather than whoever is signing in.
  it('says there is no account rather than repeating the server', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } });

    await askForALink();

    expect(screen.getByTestId('login-error')).toHaveTextContent(/no account/i);
  });

  it('passes any other failure through in the server’s own words', async () => {
    signInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });

    await askForALink();

    expect(screen.getByTestId('login-error')).toHaveTextContent('Email rate limit exceeded');
  });
});
