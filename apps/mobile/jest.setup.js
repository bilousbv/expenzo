// Intentionally minimal. Add bootstrapping here only when a test demands it —
// for example, Reanimated's test helper if a component under test animates.
// Check which package ships `setUpTests` in Reanimated 4 before reaching for it:
// it may live in `react-native-worklets` rather than `react-native-reanimated`.

const { createI18n, initReactI18next } = require('@expenzo/i18n');

/**
 * Every component test renders in English.
 *
 * The app's default is Ukrainian, but these suites assert on English text.
 * Translating the assertions would mean redoing them for the next language,
 * and swapping them for testIDs would stop them checking that the label is
 * readable at all. The Ukrainian default is proven in packages/i18n and in the
 * web locale e2e spec, where it is the subject rather than the backdrop.
 *
 * Registering the instance as react-i18next's global default is what lets
 * `useTranslation` work in components rendered without a provider. Production
 * code never does this — see create-instance.ts on concurrent renders sharing
 * one mutable language — but a jest worker renders one tree at a time.
 *
 * Without it, react-i18next has no instance and renders every string as its own
 * key, so each failure would read "Unable to find an element with text: Sign in"
 * while `auth.signIn` sat in the tree.
 */
initReactI18next.init(createI18n('en'));
