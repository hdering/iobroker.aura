import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
    {
        ignores: ['www/**', 'node_modules/**', 'dist/**'],
    },
    {
        files: ['src-vis/**/*.{ts,tsx}', 'main.js'],
        plugins: {
            '@typescript-eslint': tsPlugin,
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaFeatures: { jsx: true },
                ecmaVersion: 'latest',
                sourceType: 'module',
            },
        },
        settings: {
            react: { version: 'detect' },
        },
        rules: {
            ...reactPlugin.configs.recommended.rules,
            ...reactHooksPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
            'no-unused-vars': 'off',
        },
    },
    {
        files: ['main.js'],
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
            '@typescript-eslint/no-var-requires': 'off',
        },
    },
];
