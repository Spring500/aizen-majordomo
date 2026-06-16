import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { serve } from '@hono/node-server';
import type { Server } from 'node:http';
import { copyScenarioDb, finalScenarioConfigPath, prepareScenario } from '../../scripts/scenario-lib.ts';

export interface ScenarioRuntime {
  scenarioId: string;
  dbPath: string;
  configSeedPath?: string;
}

export interface ScenarioServer {
  url: string;
  close: () => Promise<void>;
}

export async function prepareScenarioRuntime(scenarioId: string): Promise<ScenarioRuntime> {
  const dir = resolve(process.cwd(), '.tmp', 'e2e', `vitest-${process.env.VITEST_POOL_ID ?? 'local'}`);
  mkdirSync(dir, { recursive: true });
  const dbPath = join(dir, `${scenarioId}-${process.pid}-${Date.now()}.db`);
  await prepareScenario(scenarioId);
  await copyScenarioDb(scenarioId, dbPath);
  return { scenarioId, dbPath, configSeedPath: finalScenarioConfigPath(scenarioId) };
}

function withRuntimeEnv<T>(runtime: ScenarioRuntime, run: () => T): T {
  const previousDbPath = process.env.DB_PATH;
  const previousSeedPath = process.env.CONFIG_SEED_PATH;
  process.env.DB_PATH = runtime.dbPath;
  if (runtime.configSeedPath) process.env.CONFIG_SEED_PATH = runtime.configSeedPath;
  try {
    return run();
  } finally {
    if (previousDbPath === undefined) {
      delete process.env.DB_PATH;
    } else {
      process.env.DB_PATH = previousDbPath;
    }
    if (previousSeedPath === undefined) {
      delete process.env.CONFIG_SEED_PATH;
    } else {
      process.env.CONFIG_SEED_PATH = previousSeedPath;
    }
  }
}

export async function startScenarioServer(
  runtime: ScenarioRuntime,
  options: { port?: number } = {},
): Promise<ScenarioServer> {
  const { createDb } = await import('../../src/db/index.ts');
  const { createApp } = await import('../../src/app.ts');
  const db = withRuntimeEnv(runtime, () => createDb(runtime.dbPath));
  const app = createApp(db);
  const port = options.port ?? 0;

  return new Promise((resolve, reject) => {
    const server = serve({ fetch: app.fetch, port }, (info) => {
      resolve({
        url: `http://127.0.0.1:${info.port}`,
        close: () =>
          new Promise<void>((closeResolve, closeReject) => {
            (server as Server).close((error) => {
              db.close();
              if (error) closeReject(error);
              else closeResolve();
            });
          }),
      });
    }) as Server;
    server.on('error', reject);
  });
}
