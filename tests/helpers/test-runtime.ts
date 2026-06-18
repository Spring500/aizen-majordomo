import { rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Shared test runtime paths/env helpers.
// Test code should use these helpers instead of hard-coding ports, `.tmp`, or
// `data/scenarios` paths.
let cachedRunId: string | undefined;

// Sanitizes values before using them as path segments or env-visible ids.
function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '-');
}

// Returns the stable id for the current test command.
// External TEST_RUN_ID wins so CI or local debugging can reproduce a run path.
export function testRunId(prefix = 'test'): string {
  if (process.env.TEST_RUN_ID) return safeSegment(process.env.TEST_RUN_ID);
  cachedRunId ??= `${safeSegment(prefix)}-${process.pid}-${Date.now()}`;
  return cachedRunId;
}

// Root directory for all disposable files created by one test command.
export function testRunDir(prefix = 'test'): string {
  return resolve(process.cwd(), process.env.TEST_RUN_DIR ?? join('.tmp', 'test-runs', testRunId(prefix)));
}

// Directory used by scenario-lib for prepared and runtime scenario databases.
export function scenarioDbDir(prefix = 'test'): string {
  return resolve(process.env.SCENARIO_DB_DIR ?? join(testRunDir(prefix), 'scenarios'));
}

// Directory used by test helpers for per-test copied runtime databases.
export function runtimeDbDir(prefix = 'test'): string {
  return resolve(join(testRunDir(prefix), 'runtime'));
}

// Env block passed to child processes so every layer shares the same run dir.
export function testRunEnv(prefix = 'test'): Record<string, string> {
  const id = testRunId(prefix);
  const dir = testRunDir(prefix);
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') env[key] = value;
  }
  return {
    ...env,
    TEST_RUN_ID: id,
    TEST_RUN_DIR: dir,
    SCENARIO_DB_DIR: scenarioDbDir(prefix),
  };
}

// Removes only this command's test run directory; do not call while workers may
// still hold SQLite files open.
export function cleanupTestRunDir(prefix = 'test'): void {
  rmSync(testRunDir(prefix), { recursive: true, force: true });
}
