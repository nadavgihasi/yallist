import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';

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
