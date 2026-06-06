import type { DatabaseSync } from 'node:sqlite';

// Hono context 变量类型:数据库连接经中间件注入,供各路由读取。
export type AppEnv = { Variables: { db: DatabaseSync } };
