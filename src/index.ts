import { serve } from '@hono/node-server';
import { createDb } from './db/index.ts';
import { createApp } from './app.ts';

const db = createDb();
const app = createApp(db);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`aizen-majordomo listening on http://localhost:${info.port}`);
});
