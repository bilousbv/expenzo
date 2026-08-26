import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createI18n,
  defaultLocale,
  I18nextProvider,
  resolveLocale,
  type Locale,
} from '@expenzo/i18n';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'expenzo.locale';

interface LocaleControl {
  locale: Locale;
  setLocale: (next: Locale) => void;
}

const LocaleContext = createContext<LocaleControl>({
  locale: defaultLocale,
  setLocale: () => {},
});

export function useLocale(): LocaleControl {
  return useContext(LocaleContext);
}

/**
 * Language for the phone app.
 *
 * AsyncStorage rather than a cookie, and read in an effect because it is async.
 * The first frame therefore renders in the default language — which is exactly
 * what a first-time user should see anyway, and for anyone who has chosen
 * otherwise the read resolves within a frame or two. Blocking the whole tree on
 * a splash screen to avoid that would be a worse trade: a visible delay on
 * every cold start to spare a rare flash.
 *
 * `resolveLocale` guards the stored value. AsyncStorage is not a trust
 * boundary, but the string was written by a previous version of this app and a
 * locale we have since dropped must fall back rather than reach i18next.
 */
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(defaultLocale);
  const [i18n, setI18n] = useState(() => createI18n(defaultLocale));

  useEffect(() => {
    let active = true;

    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      const resolved = resolveLocale(stored);
      // Nothing to do for the overwhelmingly common case where the stored
      // language is the one already rendering.
      if (!active || resolved === defaultLocale) return;

      setLocaleState(resolved);
      setI18n(createI18n(resolved));
    });

    return () => {
      active = false;
    };
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    // A new instance rather than `changeLanguage`, so every subscriber
    // re-renders for the same reason the web provider builds one per locale.
    setI18n(createI18n(next));
    void AsyncStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  );
}
