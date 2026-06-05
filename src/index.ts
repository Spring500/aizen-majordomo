import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { migrate } from './db/index.ts';
import { cards } from './routes/cards.ts';

migrate();

const app = new Hono();

app.get('/health', (c) =>
  c.json({ status: 'ok', name: 'aizen-majordomo', time: Date.now() }),
);

app.route('/cards', cards);

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`aizen-majordomo listening on http://localhost:${info.port}`);
});
