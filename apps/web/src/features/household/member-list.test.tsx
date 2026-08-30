import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemberList, type MemberRow } from './member-list';

const rows: MemberRow[] = [
  { userId: 'owner-id', name: 'Ana', role: 'owner', avatarUrl: null },
  { userId: 'adult-id', name: 'Ben', role: 'adult', avatarUrl: null },
  { userId: 'child-id', name: 'Cara', role: 'child', avatarUrl: null },
];

function setup(overrides: Partial<Parameters<typeof MemberList>[0]> = {}) {
  const onRoleChange = vi.fn().mockResolvedValue(undefined);
  const onRemove = vi.fn().mockResolvedValue(undefined);

  render(
    <MemberList
      rows={rows}
      canManage
      onRoleChange={onRoleChange}
      onRemove={onRemove}
      {...overrides}
    />,
  );

  return { onRoleChange, onRemove };
}

describe('MemberList', () => {
  it('names everyone in the household', () => {
    setup();

    expect(screen.getAllByTestId('member-name').map((node) => node.textContent)).toEqual([
      'Ana',
      'Ben',
      'Cara',
    ]);
  });

  it('changes what a member is', async () => {
    const { onRoleChange } = setup();

    await userEvent.selectOptions(screen.getByTestId('member-role-child-id'), 'adult');

    await waitFor(() =>
      expect(onRoleChange).toHaveBeenCalledWith({ member: 'child-id', role: 'adult' }),
    );
  });

  it('removes a member', async () => {
    const { onRemove } = setup();

    await userEvent.click(screen.getByTestId('member-remove-child-id'));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('child-id'));
  });

  // The owner's membership is what households.owner_id points at. The database
  // refuses both of these; the screen not offering them is what stops somebody
  // finding that out by trying.
  it('offers neither control for the owner', () => {
    setup();

    expect(screen.queryByTestId('member-remove-owner-id')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-role-owner-id')).not.toBeInTheDocument();
  });

  it('offers nothing at all to somebody who cannot manage', () => {
    setup({ canManage: false });

    expect(screen.queryByTestId('member-remove-child-id')).not.toBeInTheDocument();
    expect(screen.queryByTestId('member-role-child-id')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('member-role')).toHaveLength(3);
  });

  it('surfaces a refusal', async () => {
    setup({
      onRemove: vi.fn().mockRejectedValue(new Error('The household owner cannot be removed')),
    });

    await userEvent.click(screen.getByTestId('member-remove-child-id'));

    expect(await screen.findByTestId('member-error')).toHaveTextContent(/cannot be removed/i);
  });
});
