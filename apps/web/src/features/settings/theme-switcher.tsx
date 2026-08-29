'use client';

import { useTranslation } from '@expenzo/i18n';
import { fieldInputClass, THEMES, type Theme } from '@expenzo/ui';
import { useRouter } from 'next/navigation';
import { useId, useTransition } from 'react';

import { setTheme } from '@/app/theme-action';

/**
 * Picks the colour scheme.
 *
 * The value is held in a cookie and applied on the server, so this only has to
 * record the choice and ask for a re-render. Flipping a class in the browser
 * would work until the next navigation, which would arrive server-rendered in
 * the old scheme.
 */
export function ThemeSwitcher({ theme }: { theme: Theme }) {
  const { t } = useTranslation();
  const selectId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await setTheme(value);
      // The class lives on <html>, written during the server render, so the
      // new scheme only appears once the server components re-render.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-content-muted">
        {t('settings.appearance')}
      </label>

      <select
        id={selectId}
        data-testid="theme-select"
        value={theme}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        className={fieldInputClass()}
      >
        {THEMES.map((option) => (
          <option key={option} value={option}>
            {t(`settings.theme.${option}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
