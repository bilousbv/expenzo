import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CredentialsForm } from './credentials-form';

const SIGN_IN = /sign in/i;
const CREATE = /create account/i;

describe('CredentialsForm', () => {
  it('asks for an email and a password', () => {
    render(<CredentialsForm mode="signIn" onSubmit={vi.fn()} />);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: SIGN_IN })).toBeInTheDocument();
  });

  // Confirming a password you are typing for the first time is worth the extra
  // field; confirming one you already know is friction.
  it('confirms the password only when registering', () => {
    const { unmount } = render(<CredentialsForm mode="signIn" onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText('Confirm password')).not.toBeInTheDocument();
    unmount();

    render(<CredentialsForm mode="signUp" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Confirm password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: CREATE })).toBeInTheDocument();
  });

  it('submits the credentials', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: SIGN_IN }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  // GoTrue compares addresses lowercased, so registering as Ana@Example.com and
  // signing in as ana@example.com has to be one account.
  it('normalises the address before submitting', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), '  Ana@Example.COM  ');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: SIGN_IN }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  it('does not send the password as part of the address', async () => {
    const onSubmit = vi.fn();
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'not-an-email');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: SIGN_IN }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/valid email/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than the server would accept', async () => {
    const onSubmit = vi.fn();
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: CREATE }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 8/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('rejects a confirmation that does not match', async () => {
    const onSubmit = vi.fn();
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'hunter23');
    await userEvent.click(screen.getByRole('button', { name: CREATE }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // The confirmation field is not sent anywhere — it only has to equal what was
  // already typed.
  it('sends only the email and the password when registering', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CredentialsForm mode="signUp" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: CREATE }));

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ email: 'ana@example.com', password: 'hunter22' }),
    );
  });

  it('surfaces a server failure without losing the address', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Invalid login credentials'));
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');
    await userEvent.click(screen.getByRole('button', { name: SIGN_IN }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i);
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
  });

  // Two sign-up requests for the same address race, and the loser comes back
  // "User already registered" for an account the user just made themselves.
  it('ignores a second submit while the first is in flight', async () => {
    let release = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    render(<CredentialsForm mode="signIn" onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Email'), 'ana@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'hunter22');

    const submit = screen.getByRole('button', { name: /sign in|signing in/i });
    await userEvent.click(submit);
    await userEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  // Browsers only offer to save a password, and only fill the right one, when
  // the field says which kind it is.
  it('tells the password manager which kind of password this is', () => {
    const { unmount } = render(<CredentialsForm mode="signIn" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
    unmount();

    render(<CredentialsForm mode="signUp" onSubmit={vi.fn()} />);
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });
});
