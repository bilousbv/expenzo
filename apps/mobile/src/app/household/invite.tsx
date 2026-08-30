import { useCurrentHousehold, useSendInvitation } from '@expenzo/data';
import { useTranslation } from '@expenzo/i18n';
import { Card } from '@expenzo/ui';

import { FormScreen } from '../../features/layout/form-screen';
import { InviteForm, type InviteSubmission } from '../../features/household/invite-form';

/**
 * Inviting somebody, presented as a modal.
 *
 * A route rather than a sheet on the household screen, matching expense/new
 * and subscription/new: the modal presentation is the navigator's business.
 */
export default function InviteScreen() {
  const { i18n } = useTranslation();
  const household = useCurrentHousehold();
  const send = useSendInvitation(household.data?.id, i18n.language);

  async function invite(submission: InviteSubmission) {
    // Deliberately does not dismiss: the modal stays on its confirmation,
    // because "sent to whom" is what the person inviting wants to read back.
    await send.mutateAsync(submission);
  }

  return (
    <FormScreen>
      <Card className="gap-gutter">
        <InviteForm onInvite={invite} disabled={!household.data?.id} />
      </Card>
    </FormScreen>
  );
}
