import globals from 'globals';
import pluginReactHooks from 'eslint-plugin-react-hooks';

import { baseConfig } from './base.js';

/**
 * Config for React Native / shared-component packages.
 *
 * `eslint-plugin-react` is deliberately absent: 7.37.5 is the latest release and
 * it still caps its ESLint peer at ^9.7, crashing under ESLint 10. The hooks
 * plugin covers the rules that actually matter here.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const reactNativeConfig = [
  ...baseConfig,
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        __DEV__: 'readonly',
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': pluginReactHooks },
    rules: {
      ...pluginReactHooks.configs.recommended.rules,
    },
  },
];

export default reactNativeConfig;
