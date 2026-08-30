import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { InviteForm } from '../src/features/household/invite-form';
import { MemberList, type MemberRow } from '../src/features/household/member-list';
import { PendingInvitations } from '../src/features/household/pending-invitations';

const rows: MemberRow[] = [
  { userId: 'owner-id', name: 'Ana', role: 'owner', avatarUrl: null },
  { userId: 'child-id', name: 'Cara', role: 'child', avatarUrl: null },
];

describe('InviteForm (native)', () => {
  it('rejects a malformed address without calling the server', async () => {
    const onInvite = jest.fn<(submission: { email: string; role: string }) => Promise<void>>();
    render(<InviteForm onInvite={onInvite} />);

    fireEvent.changeText(screen.getByTestId('invite-email'), 'nope');
    fireEvent.press(screen.getByTestId('invite-submit'));

    await waitFor(() => expect(screen.getByTestId('invite-error')).toBeTruthy());
    expect(onInvite).not.toHaveBeenCalled();
  });

  it('invites an adult unless told otherwise', async () => {
    const onInvite = jest
      .fn<(submission: { email: string; role: string }) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    fireEvent.changeText(screen.getByTestId('invite-email'), 'ben@example.com');
    fireEvent.press(screen.getByTestId('invite-submit'));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({ email: 'ben@example.com', role: 'adult' }),
    );
  });

  it('sends the role that was chosen', async () => {
    const onInvite = jest
      .fn<(submission: { email: string; role: string }) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    fireEvent.changeText(screen.getByTestId('invite-email'), 'kid@example.com');
    fireEvent.press(screen.getByTestId('invite-role-child'));
    fireEvent.press(screen.getByTestId('invite-submit'));

    await waitFor(() =>
      expect(onInvite).toHaveBeenCalledWith({ email: 'kid@example.com', role: 'child' }),
    );
  });

  // The token exists in the email and nowhere else now, so there is nothing
  // here to copy — only confirmation that it went.
  it('confirms the send without showing a link', async () => {
    const onInvite = jest
      .fn<(submission: { email: string; role: string }) => Promise<void>>()
      .mockResolvedValue(undefined);
    render(<InviteForm onInvite={onInvite} />);

    fireEvent.changeText(screen.getByTestId('invite-email'), 'ben@example.com');
    fireEvent.press(screen.getByTestId('invite-submit'));

    await waitFor(() => expect(screen.getByTestId('invite-sent')).toBeTruthy());
    expect(screen.queryByTestId('invite-link')).toBeNull();
  });
});

describe('MemberList (native)', () => {
  function setup(canManage = true) {
    const onRoleChange = jest
      .fn<(change: { member: string; role: string }) => Promise<void>>()
      .mockResolvedValue(undefined);
    const onRemove = jest.fn<(member: string) => Promise<void>>().mockResolvedValue(undefined);

    render(
      <MemberList
        rows={rows}
        canManage={canManage}
        onRoleChange={onRoleChange}
        onRemove={onRemove}
      />,
    );

    return { onRoleChange, onRemove };
  }

  it('names everyone in the household', () => {
    setup();

    expect(screen.getAllByTestId('member-name').map((node) => node.props.children)).toEqual([
      'Ana',
      'Cara',
    ]);
  });

  it('changes what a member is', async () => {
    const { onRoleChange } = setup();

    fireEvent.press(screen.getByTestId('member-role-child-id-adult'));

    await waitFor(() =>
      expect(onRoleChange).toHaveBeenCalledWith({ member: 'child-id', role: 'adult' }),
    );
  });

  it('removes a member', async () => {
    const { onRemove } = setup();

    fireEvent.press(screen.getByTestId('member-remove-child-id'));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith('child-id'));
  });

  // The database refuses both of these for the owner. Offering a control that
  // can only fail is how somebody finds that out the unpleasant way.
  it('offers neither control for the owner', () => {
    setup();

    expect(screen.queryByTestId('member-remove-owner-id')).toBeNull();
    expect(screen.queryByTestId('member-role-owner-id-adult')).toBeNull();
  });

  it('offers nothing at all to somebody who cannot manage', () => {
    setup(false);

    expect(screen.queryByTestId('member-remove-child-id')).toBeNull();
    expect(screen.queryByTestId('member-role-child-id-adult')).toBeNull();
  });
});

describe('PendingInvitations (native)', () => {
  const invitations = [
    { id: 'inv-1', email: 'ben@example.com', role: 'adult', expiresAt: '2026-09-13T09:00:00.000Z' },
  ];

  it('lists who has been asked', () => {
    render(
      <PendingInvitations
        rows={invitations}
        canManage
        onRevoke={jest.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByTestId('invitation-email').props.children).toBe('ben@example.com');
  });

  it('withdraws one', async () => {
    const onRevoke = jest.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined);
    render(<PendingInvitations rows={invitations} canManage onRevoke={onRevoke} />);

    fireEvent.press(screen.getByTestId('invitation-revoke-inv-1'));

    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith('inv-1'));
  });

  it('says so when nobody is waiting', () => {
    render(
      <PendingInvitations
        rows={[]}
        canManage
        onRevoke={jest.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.getByTestId('no-invitations')).toBeTruthy();
  });

  it('offers no withdrawal to somebody who cannot manage', () => {
    render(
      <PendingInvitations
        rows={invitations}
        canManage={false}
        onRevoke={jest.fn<(id: string) => Promise<void>>()}
      />,
    );

    expect(screen.queryByTestId('invitation-revoke-inv-1')).toBeNull();
  });
});
