import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { listChangesSince } from '../changes/repository.ts';
import { parseSince } from '../changes/validation.ts';
import { badRequest } from '../http/errors.ts';

export const changes = new Hono<AppEnv>();

changes.get('/', (c) => {
  const parsed = parseSince(new URL(c.req.url));
  if (!parsed.ok) return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', parsed.error);

  return c.json(listChangesSince(c.get('db'), parsed.value));
});
