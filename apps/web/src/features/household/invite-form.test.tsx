import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InviteForm } from './invite-form';

describe('InviteForm', () => {
  it('rejects a malformed address without calling the server', async () => {
    const onInvite = vi.fn();
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(await screen.findByTestId('invite-error')).toHaveTextContent(/valid email/i);
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('invites an adult unless told otherwise', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({ email: 'ben@example.com', role: 'adult' }),
    );
  });

  it('sends the role that was chosen', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'kid@example.com');
    await userEvent.click(screen.getByTestId('invite-role-child'));
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({ email: 'kid@example.com', role: 'child' }),
    );
  });

  // The token is a bearer credential and now exists only in the email. Showing
  // it on the settings screen made the invitation as private as that screen.
  it('confirms the send without showing a link', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(await screen.findByTestId('invite-sent')).toHaveTextContent(/ben@example.com/);
    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
  });

  it('disables the button while the request is in flight', async () => {
    let release: () => void = () => {};
    const onInvite = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invit/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /invit/i })).toBeDisabled());
    release();
  });

  it('surfaces a server failure', async () => {
    const onInvite = vi.fn().mockRejectedValue(new Error('Only an owner or adult can invite'));
    render(<InviteForm onInvite={onInvite} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(await screen.findByTestId('invite-error')).toHaveTextContent(/owner or adult/i);
  });
});
