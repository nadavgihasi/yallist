import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import { plugin as tseslintPlugin } from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['**/dist/', '**/.expo/', '**/.sst/', '**/sst-env.d.ts', '**/expo-env.d.ts']),
  expoConfig,
  prettierConfig,
  {
    settings: {
      'import/resolver': {
        typescript: { project: ['apps/*/tsconfig.json', 'packages/*/tsconfig.json'] },
      },
    },
  },
  {
    // Type-aware rules for bugs tsc doesn't catch: promises nobody awaits or catches (unhandled
    // rejections), and objects stringified as "[object Object]".
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.ts'],
    plugins: { '@typescript-eslint': tseslintPlugin },
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/only-throw-error': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
    },
  },
  {
    // The app may only borrow the API's types (for `hc<AppType>`); a value import would bundle
    // server code into the client.
    files: ['apps/mobile/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@yallist/api', '@yallist/api/*'],
              allowTypeImports: true,
              message: 'Only `import type` from the API; never runtime code.',
            },
          ],
        },
      ],
    },
  },
]);
