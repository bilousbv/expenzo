import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config every workspace extends.
 * `eslintConfigPrettier` stays last so formatting rules never fight Prettier.
 *
 * @type {import("eslint").Linter.Config[]}
 */
export const baseConfig = [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.expo/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/build/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Typed rules are deliberately avoided: eslint-config-next swaps in its
      // own parser, which does not forward `parserOptions.project`.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Build and test tooling (metro, babel, tailwind, postcss, jest) is CommonJS.
    files: ['**/*.config.{js,cjs}', '**/*.setup.{js,cjs}', '**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: globals.node,
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  eslintConfigPrettier,
];

export default baseConfig;
