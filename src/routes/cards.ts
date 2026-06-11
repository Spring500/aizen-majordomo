import { Hono } from 'hono';
import type { AppEnv } from '../types.ts';
import { createCard, findCardById, listCards, updateCard } from '../cards/repository.ts';
import { serializeCard } from '../cards/serialize.ts';
import { createCardSchema, parsePagination, updateCardSchema, zodFieldError } from '../cards/validation.ts';
import { badRequest, notFound } from '../http/errors.ts';

export const cards = new Hono<AppEnv>();

cards.get('/', (c) => {
  const pagination = parsePagination(new URL(c.req.url));
  if (!pagination.ok) {
    return badRequest(c, 'VALIDATION_ERROR', '查询参数无效', pagination.error);
  }

  const result = listCards(c.get('db'), {
    type: c.req.query('type'),
    status: c.req.query('status'),
    lane: c.req.query('lane'),
    assignee: c.req.query('assignee'),
    ...pagination.value,
  });

  return c.json({ cards: result.rows.map(serializeCard), total: result.total });
});

cards.post('/', async (c) => {
  const parsed = createCardSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', zodFieldError(parsed.error));
  }

  const row = createCard(c.get('db'), {
    ...parsed.data,
    actor: c.req.header('X-Actor') ?? undefined,
  });

  return c.json({ card: serializeCard(row) }, 201);
});

cards.get('/:id', (c) => {
  const row = findCardById(c.get('db'), c.req.param('id'));
  if (!row) return notFound(c);

  return c.json({ card: serializeCard(row) });
});

cards.patch('/:id', async (c) => {
  const parsed = updateCardSchema.safeParse(await c.req.json().catch(() => undefined));
  if (!parsed.success) {
    const details = zodFieldError(parsed.error);
    if (details.field === 'status') {
      return badRequest(c, 'STATUS_PATCH_FORBIDDEN', '阶段 1 不允许通过 PATCH 修改 status', details);
    }
    return badRequest(c, 'VALIDATION_ERROR', '请求参数无效', details);
  }

  const row = updateCard(c.get('db'), c.req.param('id'), parsed.data);
  if (!row) return notFound(c);

  return c.json({ card: serializeCard(row) });
});
