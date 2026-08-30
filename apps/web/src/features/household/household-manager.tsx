'use client';

import {
  useAvatarUrls,
  useCurrentHousehold,
  useHouseholdMembers,
  useInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useSendInvitation,
  useSetMemberRole,
} from '@expenzo/data';
import { canManageMembers } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, Card } from '@expenzo/ui';
import { useState } from 'react';

import { FormDialog } from '@/features/layout/form-dialog';

import { InviteForm, type InviteSubmission } from './invite-form';
import { MemberList, type MemberRow } from './member-list';
import { PendingInvitations } from './pending-invitations';

/**
 * Who is in the household, who has been asked, and the button that asks.
 *
 * A client component rather than the server page it replaced: every control on
 * it mutates, and the roster has to re-render as soon as one of them lands.
 * The page around it stays server-rendered.
 */
export function HouseholdManager({ userId }: { userId: string | undefined }) {
  const { t, i18n } = useTranslation();
  const household = useCurrentHousehold();
  const householdId = household.data?.id;

  const members = useHouseholdMembers(householdId);
  const invitations = useInvitations(householdId);
  const avatars = useAvatarUrls((members.data ?? []).map((member) => member.avatarPath));

  const send = useSendInvitation(householdId, i18n.language);
  const revoke = useRevokeInvitation(householdId);
  const setRole = useSetMemberRole(householdId);
  const remove = useRemoveMember(householdId);

  const [inviting, setInviting] = useState(false);

  // What the reader may do, read off their own membership. The database
  // decides this too — these functions all refuse a child — so this only
  // governs what is offered.
  const me = (members.data ?? []).find((member) => member.userId === userId);
  const canManage = canManageMembers(me?.role);

  const rows: MemberRow[] = (members.data ?? []).map((member) => ({
    userId: member.userId,
    name: member.displayName,
    role: member.role,
    avatarUrl: member.avatarPath ? (avatars.data?.get(member.avatarPath) ?? null) : null,
  }));

  async function invite(submission: InviteSubmission) {
    await send.mutateAsync(submission);
  }

  return (
    <>
      <Card className="gap-gutter">
        {/* The button sits in the roster's own header rather than under a
            separate "invite someone" card: adding a person to this list is
            what the list is for. */}
        <div className="flex flex-row items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-content">{t('household.members')}</h2>

          {canManage ? (
            <button
              type="button"
              data-testid="open-invite-dialog"
              onClick={() => setInviting(true)}
              className={buttonContainerClass('primary', 'sm')}
            >
              <span className={buttonLabelClass('primary', 'sm')}>{t('household.invite')}</span>
            </button>
          ) : null}
        </div>

        <MemberList
          rows={rows}
          canManage={canManage}
          onRoleChange={(change) => setRole.mutateAsync(change)}
          onRemove={(member) => remove.mutateAsync(member)}
        />
      </Card>

      <Card className="gap-gutter">
        <h2 className="text-lg font-semibold text-content">{t('household.pending')}</h2>
        <PendingInvitations
          rows={invitations.data ?? []}
          canManage={canManage}
          onRevoke={(id) => revoke.mutateAsync(id)}
        />
        <p className="text-xs text-content-muted">{t('household.manageExplainer')}</p>
      </Card>

      <FormDialog
        open={inviting}
        onClose={() => setInviting(false)}
        title={t('household.inviteSomeone')}
        testID="invite-dialog"
        closeTestID="close-invite-dialog"
      >
        <InviteForm onInvite={invite} />
      </FormDialog>
    </>
  );
}
