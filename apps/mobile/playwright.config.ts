import { defineConfig } from '@playwright/test';

/**
 * The preview-only UI tests (e2e/preview): what the Maestro flows can't do or the local stack
 * can't serve. They run against a deployed PR preview, E2E_WEB_URL=https://<router>/pr-<n>/
 * (preview.yml). See docs/plans/ui-tests.md.
 */
const out = process.env.E2E_OUT ?? 'test-results';

export default defineConfig({
  testDir: 'e2e/preview',
  outputDir: `${out}/playwright`,
  // Each test signs in its own new guests, so they share the preview's database without seeing
  // each other's data, and run in parallel.
  fullyParallel: true,
  workers: 4,
  forbidOnly: !!process.env.CI,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['junit', { outputFile: `${out}/junit.xml` }]],
  use: {
    baseURL: process.env.E2E_WEB_URL,
    // A phone, as the Maestro flows use.
    viewport: { width: 390, height: 844 },
    // Every page's video, as the Maestro flows keep (under playwright/<test>/), and a trace
    // (DOM, network, console per step) when a test fails.
    video: 'on',
    trace: 'retain-on-failure',
  },
});
