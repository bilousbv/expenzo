'use client';

import { LOCALE_LABEL, locales, useTranslation, type Locale } from '@expenzo/i18n';
import { fieldInputClass } from '@expenzo/ui';
import { useRouter } from 'next/navigation';
import { useId, useTransition } from 'react';

import { setLocale } from '@/app/locale-action';

/**
 * A real `<select>`, matching the category and currency pickers: keyboard
 * behaviour, the platform picker on a phone browser and screen-reader support
 * all come for free and are each easy to get wrong by hand.
 */
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const { t } = useTranslation();
  const selectId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleChange(value: string) {
    startTransition(async () => {
      await setLocale(value);
      // The server holds the language, so the new one only appears once the
      // server components re-render. Without this the select would move and
      // nothing else on the page would.
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={selectId} className="text-sm font-medium text-content-muted">
        {t('common.language')}
      </label>

      <select
        id={selectId}
        data-testid="language-select"
        value={locale}
        disabled={pending}
        onChange={(event) => handleChange(event.target.value)}
        className={fieldInputClass()}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {LOCALE_LABEL[option]}
          </option>
        ))}
      </select>
    </div>
  );
}
