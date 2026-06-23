import { serve } from '@hono/node-server';
import { createDb } from './db/index.ts';
import { createApp } from './app.ts';

let db;
try {
  db = createDb();
} catch (error) {
  console.error('启动失败：配置校验未通过。');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const app = createApp(db);

const port = Number(process.env.PORT ?? 3000);

const server = serve({ fetch: app.fetch, port }, (info) => {
  console.log(`aizen-majordomo listening on http://localhost:${info.port}`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`启动失败：端口 ${port} 已被占用。请先关闭占用该端口的进程，或通过 PORT 指定其他端口。`);
  } else {
    console.error('启动失败：HTTP 服务无法启动。');
  }
  console.error(error.stack ?? error);
  process.exit(1);
});
