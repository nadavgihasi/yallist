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
]);
