import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm build:web && node --experimental-sqlite --no-warnings --import tsx scripts/e2e-server.ts',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
