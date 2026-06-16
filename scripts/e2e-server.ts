import { serve } from '@hono/node-server';
import { finalScenarioConfigPath, prepareScenarioRuntime } from './scenario-lib.ts';

const dbPath = await prepareScenarioRuntime('default-sample', true);
process.env.DB_PATH = dbPath;
const configSeedPath = finalScenarioConfigPath('default-sample');
if (configSeedPath) process.env.CONFIG_SEED_PATH = configSeedPath;

const { createApp } = await import('../src/app.ts');
const { createDb } = await import('../src/db/index.ts');

const db = createDb(dbPath);
const app = createApp(db);

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`aizen-majordomo e2e listening on http://127.0.0.1:${info.port}`);
});
