'use client';

import { invitableRoleSchema, inviteInput, type InvitableRole } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useId, useState, type FormEvent } from 'react';

export interface InviteSubmission {
  email: string;
  role: InvitableRole;
}

export interface InviteFormProps {
  onInvite: (submission: InviteSubmission) => Promise<void>;
}

/**
 * Asking somebody to join, and saying what they will be when they do.
 *
 * The token no longer comes back here. It used to be rendered as a link for
 * someone to copy, which made the invitation exactly as private as the screen
 * it was sitting on; now it goes straight into an email and this only ever
 * learns that the send worked.
 */
export function InviteForm({ onInvite }: InviteFormProps) {
  const { t } = useTranslation();
  const emailId = useId();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InvitableRole>('adult');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // The same schema the repository parses with, so a bad address is caught
    // before a round trip rather than by the function at the far end of one.
    const parsed = inviteInput.safeParse({ email, role });

    if (!parsed.success) {
      setError(t(parsed.error.issues[0]?.message ?? 'validation.email.invalid'));
      return;
    }

    setPending(true);
    try {
      await onInvite({ email: parsed.data.email, role: parsed.data.role });
      setSentTo(parsed.data.email);
      setEmail('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.inviteFailed'));
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-gutter">
        <p data-testid="invite-sent" className="text-sm text-content">
          {t('household.sent', { email: sentTo })}
        </p>
        <p className="text-sm text-content-muted">{t('household.sentExplainer')}</p>

        <button
          type="button"
          onClick={() => setSentTo(null)}
          className={buttonContainerClass('secondary', 'md')}
        >
          <span className={buttonLabelClass('secondary', 'md')}>
            {t('household.inviteSomeone')}
          </span>
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-gutter" noValidate>
      <label htmlFor={emailId} className="text-sm font-medium text-content-muted">
        {t('auth.email')}
      </label>

      <input
        id={emailId}
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={fieldInputClass()}
        placeholder={t('household.emailPlaceholder')}
      />

      {/* Radios rather than a select: there are two, both need a sentence of
          explanation, and the explanation is the point — "child" is a set of
          permissions, not an age. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-content-muted">
          {t('household.joiningAs')}
        </legend>

        {invitableRoleSchema.options.map((option) => (
          <label key={option} className="flex items-start gap-3">
            <input
              type="radio"
              name="role"
              value={option}
              data-testid={`invite-role-${option}`}
              checked={role === option}
              onChange={() => setRole(option)}
              className="mt-1"
            />
            <span className="flex flex-col">
              <span className="text-sm text-content">{t(`household.roles.${option}`)}</span>
              <span className="text-xs text-content-muted">
                {t(`household.roleExplainer.${option}`)}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className={buttonContainerClass('primary', 'md', pending)}
      >
        <span className={buttonLabelClass('primary', 'md')}>
          {t(pending ? 'household.inviting' : 'household.invite')}
        </span>
      </button>

      {error ? (
        <p role="alert" data-testid="invite-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </form>
  );
}
