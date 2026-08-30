import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PendingInvitations } from './pending-invitations';

const rows = [
  { id: 'inv-1', email: 'ben@example.com', role: 'adult', expiresAt: '2026-09-13T09:00:00.000Z' },
  { id: 'inv-2', email: 'kid@example.com', role: 'child', expiresAt: '2026-09-13T09:00:00.000Z' },
];

describe('PendingInvitations', () => {
  it('lists who has been asked and as what', () => {
    render(<PendingInvitations rows={rows} canManage onRevoke={vi.fn()} />);

    expect(screen.getAllByTestId('invitation-email').map((n) => n.textContent)).toEqual([
      'ben@example.com',
      'kid@example.com',
    ]);
    expect(screen.getAllByTestId('invitation-role')[1]).toHaveTextContent(/child/i);
  });

  it('withdraws one', async () => {
    const onRevoke = vi.fn().mockResolvedValue(undefined);
    render(<PendingInvitations rows={rows} canManage onRevoke={onRevoke} />);

    await userEvent.click(screen.getByTestId('invitation-revoke-inv-1'));

    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith('inv-1'));
  });

  it('says so when nobody is waiting', () => {
    render(<PendingInvitations rows={[]} canManage onRevoke={vi.fn()} />);

    expect(screen.getByTestId('no-invitations')).toBeInTheDocument();
  });

  // A child can see who has been invited — it is not a secret from the
  // household — but withdrawing one is administration.
  it('offers no withdrawal to somebody who cannot manage', () => {
    render(<PendingInvitations rows={rows} canManage={false} onRevoke={vi.fn()} />);

    expect(screen.queryByTestId('invitation-revoke-inv-1')).not.toBeInTheDocument();
  });
});
