import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CredentialsForm } from '../src/features/auth/credentials-form';

type Submit = (credentials: { email: string; password: string }) => Promise<void>;

describe('CredentialsForm (native)', () => {
  it('confirms the password only when registering', () => {
    const { unmount } = render(<CredentialsForm mode="signIn" onSubmit={jest.fn<Submit>()} />);
    expect(screen.queryByTestId('credentials-confirm')).toBeNull();
    unmount();

    render(<CredentialsForm mode="signUp" onSubmit={jest.fn<Submit>()} />);
    expect(screen.getByTestId('credentials-confirm')).toBeTruthy();
  });

  it('submits the credentials', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  // GoTrue compares addresses lowercased, so registering as Ana@Example.com and
  // signing in as ana@example.com has to be one account.
  it('normalises the address before submitting', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), '  Ana@Example.COM ');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  it('rejects a password shorter than the server would accept', async () => {
    const onSubmit = jest.fn<Submit>();
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'short');
    fireEvent.changeText(screen.getByTestId('credentials-confirm'), 'short');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() => expect(screen.getByTestId('credentials-error')).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    const onSubmit = jest.fn<Submit>();
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.changeText(screen.getByTestId('credentials-confirm'), 'hunter23');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() => expect(screen.getByTestId('credentials-error')).toBeTruthy());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // The confirmation is only ever compared. Sending it would put a second copy
  // of the password on the wire for no reason.
  it('sends only the email and the password when registering', async () => {
    const onSubmit = jest.fn<Submit>().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.changeText(screen.getByTestId('credentials-confirm'), 'hunter22');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  it('surfaces a server failure without losing the address', async () => {
    const onSubmit = jest.fn<Submit>().mockRejectedValue(new Error('Invalid login credentials'));
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.press(screen.getByTestId('credentials-submit'));

    await waitFor(() => expect(screen.getByTestId('credentials-error')).toBeTruthy());
    expect(screen.getByTestId('credentials-email').props.value).toBe('ana@example.com');
  });

  // A fast double tap lands two presses before the re-render, and two sign-up
  // requests for one address race — the loser comes back "User already
  // registered" for an account the user just made.
  it('ignores a second press while the first is in flight', () => {
    let release = () => {};
    const onSubmit = jest.fn<Submit>().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByTestId('credentials-email'), 'ana@example.com');
    fireEvent.changeText(screen.getByTestId('credentials-password'), 'hunter22');
    fireEvent.press(screen.getByTestId('credentials-submit'));
    fireEvent.press(screen.getByTestId('credentials-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  // Without secureTextEntry the password is on screen in plain text, which on a
  // phone is visible to whoever is standing behind you.
  it('masks the password fields', () => {
    render(<CredentialsForm mode="signUp" onSubmit={jest.fn<Submit>()} />);

    expect(screen.getByTestId('credentials-password').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('credentials-confirm').props.secureTextEntry).toBe(true);
  });
});
