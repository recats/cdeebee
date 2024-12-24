import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat()

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/.storybook/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.config(),
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.mts'],
    rules: {
      'semi': ['error', 'always'],
      'arrow-parens': ['error', 'as-needed'],
      'no-multiple-empty-lines': ['error', { 'max': 1 }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'object-curly-spacing': [2, 'always'],
      'quotes': [2, 'single', { 'avoidEscape': true }],
      'jsx-quotes': [2, 'prefer-single'],
    }
  }
);
