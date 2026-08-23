import { reactNativeConfig } from '@expenzo/eslint-config/react-native';

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...reactNativeConfig,
  {
    ignores: ['.expo/**', 'expo-env.d.ts', 'nativewind-env.d.ts'],
  },
];
