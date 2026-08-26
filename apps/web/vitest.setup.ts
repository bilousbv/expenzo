import '@testing-library/jest-dom/vitest';

import { createI18n, initReactI18next } from '@expenzo/i18n';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Every component test renders in English.
 *
 * The app's default is Ukrainian, but the assertions in these suites match on
 * English text. Translating them instead would mean rewriting every assertion
 * again for the next language added, and swapping them for test ids would stop
 * them checking that the user can read the label at all. The Ukrainian default
 * is covered where it is user-visible behaviour rather than an implementation
 * detail: the locale e2e spec and the catalogue tests.
 *
 * Registering the instance as react-i18next's global default is what makes
 * `useTranslation` work in components rendered without a provider. Production
 * code deliberately never does this — see the note in create-instance.ts about
 * concurrent server renders sharing one mutable language — but a test process
 * renders one component at a time in one language, so the hazard does not
 * apply and the alternative is wrapping every `render` call in the repo.
 *
 * Without it react-i18next has no instance and renders each string as its own
 * key, so every failure would read "Unable to find text: Sign in" while
 * `auth.signIn` sat on screen.
 */
initReactI18next.init(createI18n('en'));

afterEach(() => {
  cleanup();
});
