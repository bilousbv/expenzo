'use client';

import { useNotificationPreferences, useSetNotificationPreference } from '@expenzo/data';
import { SETTABLE_KINDS } from '@expenzo/domain';
import { useTranslation } from '@expenzo/i18n';
import { Card } from '@expenzo/ui';
import { useState } from 'react';

/**
 * What this member wants to be told about.
 *
 * Personal, not household business: whether somebody wants an alert is between
 * them and their phone, which is why the row is keyed on the user and the
 * policy compares `auth.uid()` rather than the household.
 *
 * Only the kinds that are actually produced get a switch. The database enum
 * carries two more, because Postgres refuses to use an enum value in the
 * transaction that added it and seeding them now avoids a migration later — but
 * a control for something that cannot happen yet is a promise the app does not
 * keep.
 */
export function NotificationPreferences({ userId }: { userId: string | undefined }) {
  const { t } = useTranslation();
  const preferences = useNotificationPreferences(userId);
  const set = useSetNotificationPreference(userId);
  const [error, setError] = useState<string | null>(null);

  /*
   * What the switch shows, which is not always what the server last said.
   *
   * While a change is in flight the switch shows the value being sent. A
   * control that stays where it was until a round trip finishes reads as
   * broken — and it is: the person has already told it what they want.
   *
   * The in-flight value comes from the mutation rather than from a second
   * piece of state, so there is nothing to keep in step and nothing to reset
   * when the query answers.
   */
  const inFlight = set.isPending ? set.variables : undefined;

  // An absent row means everything is on, so nothing has to be created when
  // somebody joins and a kind added later needs no backfill.
  const enabled = (kind: string) => {
    if (inFlight?.kind === kind && inFlight.inApp !== undefined) return inFlight.inApp;

    return preferences.data?.find((row) => row.kind === kind)?.in_app_enabled ?? true;
  };

  return (
    <Card className="flex flex-col gap-gutter">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-content">
          {t('notifications.preferences.title')}
        </h2>
        <p className="text-sm text-content-muted">{t('notifications.preferences.explainer')}</p>
      </div>

      <ul className="flex flex-col gap-4">
        {SETTABLE_KINDS.map((kind) => (
          <li key={kind} className="flex flex-row items-center justify-between gap-gutter">
            <label htmlFor={`pref-${kind}`} className="text-sm text-content">
              {t(`notifications.preferences.${kind}`)}
            </label>

            <input
              id={`pref-${kind}`}
              type="checkbox"
              data-testid={`preference-${kind}`}
              checked={enabled(kind)}
              onChange={(event) => {
                setError(null);
                set.mutate(
                  { kind, inApp: event.target.checked },
                  { onError: () => setError(t('notifications.preferences.saveFailed')) },
                );
              }}
              className="size-5 accent-accent"
            />
          </li>
        ))}
      </ul>

      <p className="text-xs text-content-muted">{t('notifications.preferences.pushSoon')}</p>

      {error ? (
        <p role="alert" data-testid="preference-error" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
