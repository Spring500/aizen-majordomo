import { defineConfig, devices } from '@playwright/test';
import { scenarioDbDir, testRunDir, testRunEnv, testRunId } from './tests/helpers/test-runtime.ts';

// Playwright config expects `scripts/run-playwright-e2e.ts` to provide PORT and
// test-run env. Keeping allocation outside this file avoids config re-evaluation
// assigning different ports to webServer and test workers.

// The wrapper script allocates PORT once before Playwright loads this config.
function requirePort(): number {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('Playwright E2E 需要通过 pnpm test:e2e 注入动态 PORT');
  }
  return port;
}

const port = requirePort();
const baseURL = `http://127.0.0.1:${port}`;
const runEnv = testRunEnv('playwright');
// Explicit keys keep the webServer environment readable and guard-testable.
const env = {
  ...runEnv,
  PORT: String(port),
  TEST_RUN_ID: testRunId('playwright'),
  TEST_RUN_DIR: testRunDir('playwright'),
  SCENARIO_DB_DIR: scenarioDbDir('playwright'),
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  workers: 1,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node --experimental-sqlite --no-warnings --import tsx scripts/e2e-server.ts',
    url: `${baseURL}/health`,
    env,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
