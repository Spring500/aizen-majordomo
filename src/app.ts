import { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { AppEnv } from './types.ts';
import { cards } from './routes/cards.ts';

// 组装 Hono 应用:把 db 经 context 注入,再挂载各路由。
// 工厂式便于测试(注入 :memory: 库)与生产(注入文件库)共用同一套装配。
export function createApp(db: DatabaseSync) {
  const app = new Hono<AppEnv>();

  app.use('*', (c, next) => {
    c.set('db', db);
    return next();
  });

  app.get('/health', (c) =>
    c.json({ status: 'ok', name: 'aizen-majordomo', time: Date.now() }),
  );

  app.route('/cards', cards);

  return app;
}
