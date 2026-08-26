export {
  defaultLocale,
  fallbackLocale,
  intlTagFor,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_LABEL,
  locales,
  resolveLocale,
  type Locale,
} from './config';

export { createI18n } from './create-instance';
export { en, type Messages } from './locales/en';
export { uk } from './locales/uk';

// Re-exported so the apps take their React binding from one place and cannot
// end up resolving a second copy of react-i18next through their own
// node_modules — two copies means two contexts, and useTranslation reading the
// empty one renders every string as its key.
export { I18nextProvider, initReactI18next, Trans, useTranslation } from 'react-i18next';
export type { i18n as I18n, TFunction } from 'i18next';
