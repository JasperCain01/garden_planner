// @ts-check
// ESLint flat config (ESLint 9). One config governs the whole monorepo; the
// `files` globs below scope framework-specific rules to the right workspaces.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  // Never lint generated or vendored output.
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'data/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Baseline: recommended JS + TypeScript rules everywhere.
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Browser code (the React app) gets browser globals plus the React Hooks
  // correctness rules (rules-of-hooks catches conditional hook calls;
  // exhaustive-deps flags stale effect dependencies).
  {
    files: ['app/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Node code (engine, etl, config files) gets Node globals.
  {
    files: ['packages/**/*.ts', '**/*.config.{ts,js}', 'app/e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // Turn off stylistic rules that Prettier owns. Must come last.
  prettier,
);
