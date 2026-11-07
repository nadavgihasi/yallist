import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Reuse workers across test files instead of a fresh one per file: most of a file's time was
    // importing the app (AWS SDK, Better Auth) again, so this runs the suite ~40% faster. Each DB
    // test file still gets its own database (test-db.ts); mocks and stubbed globals are undone after
    // every test, so nothing leaks between files.
    isolate: false,
    restoreMocks: true,
    unstubGlobals: true,
  },
});
