'use client';

import { useTranslation } from '@expenzo/i18n';
import { buttonContainerClass, buttonLabelClass } from '@expenzo/ui';
import { useState } from 'react';

export interface PendingInvitationRow {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

export interface PendingInvitationsProps {
  rows: PendingInvitationRow[];
  canManage: boolean;
  onRevoke: (id: string) => Promise<void>;
}

/**
 * Who has been asked and has not arrived yet.
 *
 * Visible to the whole household — it is not a secret who was invited — but
 * withdrawing one is administration, so only an adult is offered the button.
 */
export function PendingInvitations({ rows, canManage, onRevoke }: PendingInvitationsProps) {
  const { t, i18n } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <p data-testid="no-invitations" className="text-sm text-content-muted">
        {t('household.pendingNone')}
      </p>
    );
  }

  async function revoke(id: string) {
    setError(null);
    setBusy(id);
    try {
      await onRevoke(id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.inviteFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-content" data-testid="invitation-email">
                {row.email}
              </span>
              <span className="text-xs text-content-muted">
                <span data-testid="invitation-role">{t(`household.roles.${row.role}`)}</span>
                {' · '}
                {t('household.expires', {
                  date: new Date(row.expiresAt).toLocaleDateString(i18n.language),
                })}
              </span>
            </span>

            {canManage ? (
              <button
                type="button"
                data-testid={`invitation-revoke-${row.id}`}
                disabled={busy === row.id}
                onClick={() => revoke(row.id)}
                className={buttonContainerClass('ghost', 'sm')}
              >
                <span className={buttonLabelClass('ghost', 'sm')}>{t('household.revoke')}</span>
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? (
        <p role="alert" data-testid="invitation-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
