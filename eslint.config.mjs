// Single flat config for every app and package in the monorepo.
// App-specific rule sets (Next.js, React Native) are added next to the app when it is scaffolded.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/build/',
    '**/out/',
    '**/coverage/',
    '**/.next/',
    '**/.expo/',
    '**/.turbo/',
    '**/ios/',
    '**/android/',
    'packages/database/src/generated/',
    'packages/database/prisma/migrations/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}', '**/*.config.ts', 'packages/database/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
  prettier,
]);
