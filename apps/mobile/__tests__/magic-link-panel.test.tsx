import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

type OtpResult = Promise<{ error: { message: string } | null }>;

const mockSignInWithOtp = jest.fn<(args: unknown) => OtpResult>();

/*
 * expo-linking reads the scheme out of the expo-constants manifest, which only
 * exists in a built app — under jest it throws rather than returning a URL. The
 * scheme itself is app.json's business; what matters here is the path the link
 * comes back to.
 */
jest.mock('expo-linking', () => ({
  createURL: (path: string) => `expenzo://${path.replace(/^\//, '')}`,
}));

jest.mock('../src/lib/supabase', () => ({
  supabase: { auth: { signInWithOtp: (args: unknown) => mockSignInWithOtp(args) } },
}));

import { MagicLinkPanel } from '../src/features/auth/magic-link-panel';

describe('MagicLinkPanel', () => {
  beforeEach(() => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
  });

  /*
   * The redirect has to be the deep link app.json registers, or the link opens
   * in a browser that has no session to hand back to the app.
   */
  it('asks for a link pointing back at the app', async () => {
    render(<MagicLinkPanel />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled());

    const [args] = mockSignInWithOtp.mock.calls[0] as [
      { email: string; options: { emailRedirectTo: string } },
    ];
    expect(args.email).toBe('ana@example.com');
    expect(args.options.emailRedirectTo).toContain('/auth/callback');
  });

  /*
   * A link signs an existing account in and never quietly opens a new one.
   * Left at GoTrue's default, a typo in the address creates a second empty
   * household and the app comes up with none of the person's data in it.
   */
  it('refuses to create an account on the way in', async () => {
    render(<MagicLinkPanel />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalled());

    const [args] = mockSignInWithOtp.mock.calls[0] as [{ options: { shouldCreateUser: boolean } }];
    expect(args.options.shouldCreateUser).toBe(false);
  });

  // GoTrue's own wording is "Signups not allowed for otp", which is written for
  // whoever wrote the API call rather than whoever is signing in.
  it('says there is no account rather than repeating the server', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Signups not allowed for otp' } });
    render(<MagicLinkPanel />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent(/no account/i),
    );
  });

  it('confirms once the link is on its way', async () => {
    render(<MagicLinkPanel />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() => expect(screen.getByTestId('sign-in-sent')).toBeTruthy());
  });

  it('surfaces what the server said when the link cannot be sent', async () => {
    mockSignInWithOtp.mockResolvedValue({ error: { message: 'Email rate limit exceeded' } });
    render(<MagicLinkPanel />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'ana@example.com');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    await waitFor(() =>
      expect(screen.getByTestId('sign-in-error')).toHaveTextContent('Email rate limit exceeded'),
    );
  });
});
