/**
 * The `jest-expo/ios` preset (rather than bare `jest-expo`) runs a single
 * project and supplies the moduleFileExtensions that put `native.tsx` ahead of
 * `tsx` — that is what makes jest pick the React Native half of each shared
 * component while Vitest picks the web half.
 *
 * @type {import('jest').Config}
 */
module.exports = {
  preset: 'jest-expo/ios',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    // jest-expo's own allowlist plus the workspace UI package and NativeWind.
    // `@expo` does not prefix-match `@expenzo`, so it must be listed.
    '/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community' +
      '|expo|@expo|@expo-google-fonts|react-navigation|@react-navigation' +
      '|@sentry/react-native|native-base|standard-navigation' +
      '|nativewind|react-native-css-interop|@expenzo/ui|@expenzo/data|@expenzo/supabase-types))',
    '/node_modules/react-native-reanimated/plugin/',
    '/node_modules/@react-native/babel-preset/',
  ],
  moduleNameMapper: {
    // Pins the entry through the workspace symlink regardless of how
    // jest-resolve treats realpaths under pnpm's hoisted linker.
    '^@expenzo/ui$': '<rootDir>/../../packages/ui/src/index.ts',
    '^@expenzo/data$': '<rootDir>/../../packages/data/src/index.ts',
    '^@expenzo/supabase-types$': '<rootDir>/../../packages/supabase-types/src/index.ts',
  },
  collectCoverageFrom: ['**/*.{ts,tsx}', '!**/node_modules/**', '!**/coverage/**'],
};
