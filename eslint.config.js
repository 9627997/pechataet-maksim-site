import eslint from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      '_site/**',
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    files: ['studio/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
    },
    rules: {},
  },
  {
    files: [
      '*.config.js',
      'eslint.config.js',
      'scripts/**/*.mjs',
      'tests/**/*.js',
    ],
    ...eslint.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node, ...globals.browser },
    },
  },
];
