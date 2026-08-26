import { createInstance, type i18n } from 'i18next';

import { fallbackLocale, locales, type Locale } from './config';
import { en } from './locales/en';
import { uk } from './locales/uk';

const resources = {
  en: { translation: en },
  uk: { translation: uk },
};

/**
 * A fresh i18next instance for one locale.
 *
 * Deliberately an instance per caller rather than the module-level singleton
 * i18next also offers. On the web the server renders for whoever is asking, and
 * a shared instance carrying `language` as mutable state means two concurrent
 * requests in different languages race each other — the second `changeLanguage`
 * wins and the first user's page finishes rendering in someone else's language.
 * That failure is invisible in development, where requests arrive one at a time.
 *
 * `initReactI18next` is deliberately not applied here either: it registers the
 * instance as react-i18next's global default, which is the same shared-state
 * problem wearing a different hat. The React binding gets its instance from
 * `I18nextProvider` instead, explicitly.
 *
 * Synchronous on purpose. `init` returns a promise, but with the catalogues
 * passed in as plain objects there is no backend to wait for and translation
 * works the moment it returns. That matters for the React provider: building
 * the instance in an effect would leave the first paint without a translator,
 * and react-i18next renders a missing translator's output as the raw key — so
 * the user would watch `auth.signIn` flash before the real text replaced it.
 */
export function createI18n(locale: Locale): i18n {
  const instance = createInstance();

  void instance.init({
    lng: locale,
    fallbackLng: fallbackLocale,
    supportedLngs: [...locales],
    resources,
    interpolation: {
      // React escapes everything it renders already, and double-escaping turns
      // an apostrophe into &#39; on screen.
      escapeValue: false,
    },
  });

  return instance;
}
