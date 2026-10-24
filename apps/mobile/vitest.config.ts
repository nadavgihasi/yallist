import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Unit tests for pure app logic (state, labels). No React Native runtime. */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'] },
});
