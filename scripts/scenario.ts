import { serve } from '@hono/node-server';
import {
  copyScenarioDb,
  finalScenarioConfigPath,
  listScenarios,
  prepareScenario,
  prepareScenarioRuntime,
  SCENARIOS_DIR,
} from './scenario-lib.ts';

function usage(): never {
  console.error('用法：pnpm scenario:list | pnpm scenario:prepare <id> | pnpm scenario:copy-db <id> <target> | pnpm scenario:start <id> [--port N] [--fresh]');
  process.exit(1);
}

const [command, id, ...args] = process.argv.slice(2);

if (command === 'list') {
  for (const scenario of listScenarios()) {
    console.log(`${scenario.id.padEnd(28)} ${scenario.name}`);
  }
} else if (command === 'prepare') {
  if (!id) usage();
  const result = await prepareScenario(id);
  console.log(`已生成：${result.preparedDb}`);
} else if (command === 'copy-db') {
  const target = args[0];
  if (!id || !target) usage();
  const copied = await copyScenarioDb(id, target);
  console.log(`已复制：${copied}`);
} else if (command === 'start') {
  if (!id) usage();
  const portArgIndex = args.indexOf('--port');
  const port = portArgIndex >= 0 ? Number(args[portArgIndex + 1]) : 3000;
  const fresh = args.includes('--fresh');
  const runtimeDb = await prepareScenarioRuntime(id, fresh, portArgIndex >= 0 ? `port${port}` : undefined);
  process.env.DB_PATH = runtimeDb;
  const configSeedPath = finalScenarioConfigPath(id);
  if (configSeedPath) process.env.CONFIG_SEED_PATH = configSeedPath;
  const { createDb } = await import('../src/db/index.ts');
  const { createApp } = await import('../src/app.ts');
  const db = createDb(runtimeDb);
  const app = createApp(db);
  const scenario = listScenarios().find((item) => item.id === id);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`场景：${id}`);
    console.log(`说明：${scenario?.description ?? ''}`);
    console.log(`地址：http://127.0.0.1:${info.port}`);
    console.log(`数据库：${runtimeDb}`);
    console.log(`配置：${SCENARIOS_DIR}\\${id}\\${scenario?.config ?? scenario?.phases?.at(-1)?.config ?? ''}`);
    console.log(`说明：${SCENARIOS_DIR}\\${id}\\${scenario?.readme ?? 'README.md'}`);
  });
} else {
  usage();
}
