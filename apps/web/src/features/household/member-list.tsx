'use client';

import { invitableRoleSchema, type MemberRole } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Avatar, buttonContainerClass, buttonLabelClass, fieldInputClass } from '@expenzo/ui';
import { useState } from 'react';

export interface MemberRow {
  userId: string;
  name: string;
  role: MemberRole;
  avatarUrl: string | null;
}

export interface MemberListProps {
  rows: MemberRow[];
  /** Whether the reader is an owner or an adult. */
  canManage: boolean;
  onRoleChange: (change: { member: string; role: MemberRole }) => Promise<void>;
  onRemove: (member: string) => Promise<void>;
}

/**
 * The roster, with the two things an adult can do to it.
 *
 * The owner's row carries neither control. The database refuses both — their
 * membership is what `households.owner_id` points at — and offering a button
 * that can only fail is how somebody finds that out the unpleasant way.
 */
export function MemberList({ rows, canManage, onRoleChange, onRemove }: MemberListProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(member: string, action: () => Promise<void>) {
    setError(null);
    setBusy(member);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('household.errors.roleFailed'));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-gutter">
      <ul className="flex flex-col gap-3">
        {rows.map((row) => {
          const owner = row.role === 'owner';

          return (
            <li key={row.userId} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-3">
                <Avatar name={row.name} url={row.avatarUrl} size="sm" />
                <span className="truncate text-content" data-testid="member-name">
                  {row.name}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-2">
                {canManage && !owner ? (
                  <select
                    data-testid={`member-role-${row.userId}`}
                    aria-label={t('household.joiningAs')}
                    value={row.role}
                    disabled={busy === row.userId}
                    onChange={(event) =>
                      run(row.userId, () =>
                        onRoleChange({
                          member: row.userId,
                          role: event.target.value as MemberRole,
                        }),
                      )
                    }
                    className={fieldInputClass()}
                  >
                    {invitableRoleSchema.options.map((option) => (
                      <option key={option} value={option}>
                        {t(`household.roles.${option}`)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm text-content-muted" data-testid="member-role">
                    {t(`household.roles.${row.role}`)}
                  </span>
                )}

                {canManage && !owner ? (
                  <button
                    type="button"
                    data-testid={`member-remove-${row.userId}`}
                    disabled={busy === row.userId}
                    onClick={() => run(row.userId, () => onRemove(row.userId))}
                    className={buttonContainerClass('ghost', 'sm')}
                  >
                    <span className={buttonLabelClass('ghost', 'sm')}>{t('household.remove')}</span>
                  </button>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>

      {/* Rendered for everyone, not only when something has just been refused:
          it explains an absence — the owner's row having no controls — and an
          absence has no moment at which to announce itself. */}
      <p className="text-xs text-content-muted">{t('household.ownerNote')}</p>

      {error ? (
        <p role="alert" data-testid="member-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
