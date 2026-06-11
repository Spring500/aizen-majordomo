import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '@hono/node-server';

const dbPath = join(process.cwd(), 'data', 'e2e-stage1.db');
for (const path of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) {
  rmSync(path, { force: true });
}
process.env.DB_PATH = dbPath;

const { createApp } = await import('../src/app.ts');
const { createDb } = await import('../src/db/index.ts');

const db = createDb();
const app = createApp(db);

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`aizen-majordomo e2e listening on http://127.0.0.1:${info.port}`);
});
