import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { InviteForm } from './invite-form';

const ORIGIN = 'https://expenzo.app';

describe('InviteForm', () => {
  it('rejects a malformed address without calling the server', async () => {
    const onInvite = vi.fn();
    render(<InviteForm onInvite={onInvite} origin={ORIGIN} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'nope');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(await screen.findByTestId('invite-error')).toHaveTextContent(/valid email/i);
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('shows a shareable link built from the returned token', async () => {
    const onInvite = vi.fn().mockResolvedValue('tok_abc123');
    render(<InviteForm onInvite={onInvite} origin={ORIGIN} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    const link = await screen.findByTestId('invite-link');
    expect(link).toHaveTextContent(`${ORIGIN}/invite/tok_abc123`);
    expect(onInvite).toHaveBeenCalledWith('ben@example.com');
  });

  // The token is a bearer credential — anyone holding the link can join the
  // household — so it must not be left on screen once it has been handed over.
  it('can hide the link again once it has been shared', async () => {
    const onInvite = vi.fn().mockResolvedValue('tok_abc123');
    render(<InviteForm onInvite={onInvite} origin={ORIGIN} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));
    await screen.findByTestId('invite-link');

    await userEvent.click(screen.getByRole('button', { name: /done/i }));

    expect(screen.queryByTestId('invite-link')).not.toBeInTheDocument();
  });

  it('disables the button while the request is in flight', async () => {
    let release: () => void = () => {};
    const onInvite = vi.fn(
      () => new Promise<string>((resolve) => (release = () => resolve('tok'))),
    );
    render(<InviteForm onInvite={onInvite} origin={ORIGIN} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invit/i }));

    await waitFor(() => expect(screen.getByRole('button', { name: /invit/i })).toBeDisabled());
    release();
  });

  it('surfaces a server failure', async () => {
    const onInvite = vi.fn().mockRejectedValue(new Error('Only an owner or adult can invite'));
    render(<InviteForm onInvite={onInvite} origin={ORIGIN} />);

    await userEvent.type(screen.getByLabelText(/email/i), 'ben@example.com');
    await userEvent.click(screen.getByRole('button', { name: /invite/i }));

    expect(await screen.findByTestId('invite-error')).toHaveTextContent(/owner or adult/i);
  });
});
