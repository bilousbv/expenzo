import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InviteLanding } from './invite-landing';

const replace = vi.fn();
const accept = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/supabase/browser', () => ({ createClient: () => ({}) }));
vi.mock('@expenzo/data', () => ({ acceptInvitation: (...args: unknown[]) => accept(...args) }));

const base = {
  token: 'tok_abc',
  householdName: 'Bilous',
  email: 'ben@example.com',
  role: 'child',
};

beforeEach(() => {
  replace.mockClear();
  accept.mockReset().mockResolvedValue('household-id');
});

describe('InviteLanding', () => {
  it('redeems the invitation for somebody already signed in', async () => {
    render(<InviteLanding {...base} mode="accept" isMobile={false} />);

    expect(await screen.findByTestId('invite-accepted')).toBeInTheDocument();
    expect(accept).toHaveBeenCalledWith({}, 'tok_abc');
  });

  it('shows what the database refused', async () => {
    accept.mockRejectedValue(new Error('This invitation has already been used'));
    render(<InviteLanding {...base} mode="accept" isMobile={false} />);

    expect(await screen.findByTestId('invite-error')).toHaveTextContent(/already been used/i);
  });

  /*
   * Redeeming is a one-shot side effect against a one-shot token, and React
   * runs an effect twice on mount in development. The second call is the
   * database refusing a token the first call has just spent, which is exactly
   * right of it — so the first person to open a perfectly good invitation
   * joined the household and was told the link no longer worked.
   */
  it('redeems once even when the effect is run twice', async () => {
    accept
      .mockReset()
      .mockResolvedValueOnce('household-id')
      .mockRejectedValue(new Error('This invitation has already been used'));

    render(<InviteLanding {...base} mode="accept" isMobile={false} />, { wrapper: StrictMode });

    expect(await screen.findByTestId('invite-accepted')).toBeInTheDocument();
    expect(accept).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('invite-error')).not.toBeInTheDocument();
  });

  // The address is what the invitation was sent to, so it travels into the
  // form: signing in as somebody else joins the wrong person to the household.
  it('sends an existing account to sign in with the address filled', async () => {
    render(<InviteLanding {...base} mode="signIn" isMobile={false} />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/login?next=%2Finvite%2Ftok_abc&email=ben%40example.com',
      ),
    );
  });

  it('sends an unknown address to register instead', async () => {
    render(<InviteLanding {...base} mode="register" isMobile={false} />);

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith(
        '/register?next=%2Finvite%2Ftok_abc&email=ben%40example.com',
      ),
    );
  });

  it('says so when the link is spent, without redeeming anything', () => {
    render(
      <InviteLanding
        token="tok_abc"
        mode="invalid"
        householdName={null}
        email={null}
        role={null}
        isMobile={false}
      />,
    );

    expect(screen.getByText(/did not work/i)).toBeInTheDocument();
    expect(accept).not.toHaveBeenCalled();
  });

  // On a phone the app gets first refusal, and nothing else runs until the
  // visitor says to carry on here: redeeming the token in the browser while
  // the app is opening would spend it before the app arrived.
  it('hands off to the app on a phone rather than redeeming', () => {
    render(<InviteLanding {...base} mode="accept" isMobile />);

    expect(screen.getByTestId('open-in-app')).toHaveAttribute('href', 'expenzo://invite/tok_abc');
    expect(accept).not.toHaveBeenCalled();
  });

  it('carries on in the browser when asked to', async () => {
    render(<InviteLanding {...base} mode="accept" isMobile />);

    await userEvent.click(screen.getByTestId('continue-in-browser'));

    expect(await screen.findByTestId('invite-accepted')).toBeInTheDocument();
  });
});
